"use strict";

const sql = require('../../services/sql.js');
const utils = require('../../services/utils.js');
const entityChangesService = require('../../services/entity_changes.js');
const treeService = require('../../services/tree.js');
const eraseService = require('../../services/erase.js');
const becca = require('../../becca/becca.js');
const TaskContext = require('../../services/task_context.js');
const branchService = require('../../services/branches.js');
const log = require('../../services/log.js');
const ValidationError = require('../../errors/validation_error.js');
const eventService = require("../../services/events.js");

/**
 * Code in this file deals with moving and cloning branches. The relationship between note and parent note is unique
 * for not deleted branches. There may be multiple deleted note-parent note relationships.
 */

function moveBranchToParent(req) {
    const {branchId, parentBranchId} = req.params;

    const branchToMove = becca.getBranch(branchId);
    const targetParentBranch = becca.getBranch(parentBranchId);

    if (!branchToMove || !targetParentBranch) {
        throw new ValidationError(`One or both branches '${branchId}', '${parentBranchId}' have not been found`);
    }

    return branchService.moveBranchToBranch(branchToMove, targetParentBranch, branchId);
}

function moveBranchBeforeNote(req) {
    const {branchId, beforeBranchId} = req.params;

    const branchToMove = becca.getBranchOrThrow(branchId);
    const beforeBranch = becca.getBranchOrThrow(beforeBranchId);

    const validationResult = treeService.validateParentChild(beforeBranch.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const originalBeforeNotePosition = beforeBranch.notePosition;

    // we don't change utcDateModified, so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail

    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition >= ? AND isDeleted = 0",
        [beforeBranch.parentNoteId, originalBeforeNotePosition]);

    // also need to update becca positions
    const parentNote = becca.getNote(beforeBranch.parentNoteId);

    for (const childBranch of parentNote.getChildBranches()) {
        if (childBranch.notePosition >= originalBeforeNotePosition) {
            childBranch.notePosition += 10;
        }
    }

    if (branchToMove.parentNoteId === beforeBranch.parentNoteId) {
        branchToMove.notePosition = originalBeforeNotePosition;
        branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(beforeBranch.parentNoteId, originalBeforeNotePosition);
        newBranch.save();

        branchToMove.markAsDeleted();
    }

    treeService.sortNotesIfNeeded(parentNote.noteId);

    // if sorting is not needed, then still the ordering might have changed above manually
    entityChangesService.putNoteReorderingEntityChange(parentNote.noteId);

    log.info(`Moved note ${branchToMove.noteId}, branch ${branchId} before note ${beforeBranch.noteId}, branch ${beforeBranchId}`);

    return { success: true };
}

function moveBranchAfterNote(req) {
    const {branchId, afterBranchId} = req.params;

    const branchToMove = becca.getBranch(branchId);
    const afterNote = becca.getBranch(afterBranchId);

    const validationResult = treeService.validateParentChild(afterNote.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const originalAfterNotePosition = afterNote.notePosition;

    // we don't change utcDateModified, so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, originalAfterNotePosition]);

    // also need to update becca positions
    const parentNote = becca.getNote(afterNote.parentNoteId);

    for (const childBranch of parentNote.getChildBranches()) {
        if (childBranch.notePosition > originalAfterNotePosition) {
            childBranch.notePosition += 10;
        }
    }

    const movedNotePosition = originalAfterNotePosition + 10;

    if (branchToMove.parentNoteId === afterNote.parentNoteId) {
        branchToMove.notePosition = movedNotePosition;
        branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(afterNote.parentNoteId, movedNotePosition);
        newBranch.save();

        branchToMove.markAsDeleted();
    }

    treeService.sortNotesIfNeeded(parentNote.noteId);

    // if sorting is not needed, then still the ordering might have changed above manually
    entityChangesService.putNoteReorderingEntityChange(parentNote.noteId);

    log.info(`Moved note ${branchToMove.noteId}, branch ${branchId} after note ${afterNote.noteId}, branch ${afterBranchId}`);

    return { success: true };
}

function setExpanded(req) {
    const {branchId} = req.params;
    const expanded = parseInt(req.params.expanded);

    if (branchId !== 'none_root') {
        sql.execute("UPDATE branches SET isExpanded = ? WHERE branchId = ?", [expanded, branchId]);
        // we don't sync expanded label
        // also this does not trigger updates to the frontend, this would trigger too many reloads

        const branch = becca.branches[branchId];

        if (branch) {
            branch.isExpanded = !!expanded;
        }

        eventService.emit(eventService.ENTITY_CHANGED, {
            entityName: 'branches',
            entity: branch
        });
    }
}

function setExpandedForSubtree(req) {
    const { branchId } = req.params;
    const expanded = parseInt(req.params.expanded);

    // Find branches to update: those whose current state != target state
    const currentExpandedWeWantToChange = 1 - expanded;

    // Maximum depth limit (only applied when expanded = 1)
    const maxDepth = expanded === 1 ? 4 : 9999;  // When collapsing, basically no limit (or set a very large value)

    let branchIds = sql.getColumn(`
        WITH RECURSIVE
            tree(branchId, noteId, depth) AS (
                -- Anchor: starting node (depth 0)
                SELECT branchId, noteId, 0
                FROM branches
                WHERE branchId = ?

                UNION ALL

                -- Recursive part
                SELECT
                    b.branchId,
                    b.noteId,
                    t.depth + 1
                FROM branches b
                         JOIN tree t ON b.parentNoteId = t.noteId
                WHERE b.isDeleted = 0
                  AND b.isExpanded = ?
                  AND t.depth < ?          -- Depth restriction (< maxDepth)
            )
        SELECT branchId
        FROM tree
        WHERE depth <= ?               -- Include depth 0, up to maxDepth
          AND branchId != 'none_root'  -- Exclude special 'none_root' if it exists
    `, [branchId, currentExpandedWeWantToChange, maxDepth, maxDepth]);

    branchIds = branchIds.filter(id => id !== 'none_root');

    if (branchIds.length === 0) {
        return { branchIds: [], updatedCount: 0 };
    }

    sql.executeMany(`UPDATE branches SET isExpanded = ${expanded} WHERE branchId IN (???)`, branchIds);

    for (const branchId of branchIds) {
        const branch = becca.branches[branchId];

        if (branch) {
            branch.isExpanded = !!expanded;
        }
    }

    return {
        branchIds
    };
}

function deleteBranch(req) {
    const last = req.query.last === 'true';
    const eraseNotes = req.query.eraseNotes === 'true';
    const branch = becca.getBranchOrThrow(req.params.branchId);

    const taskContext = TaskContext.getInstance(req.query.taskId, 'deleteNotes');

    const deleteId = utils.randomString(10);
    let noteDeleted;

    if (eraseNotes) {
        // erase automatically means deleting all clones + note itself
        branch.getNote().deleteNote(deleteId, taskContext);
        eraseService.eraseNotesWithDeleteId(deleteId);
        noteDeleted = true;
    } else {
        noteDeleted = branch.deleteBranch(deleteId, taskContext);
    }

    if (last) {
        taskContext.taskSucceeded();
    }

    return {
        noteDeleted: noteDeleted
    };
}

function setPrefix(req) {
    const branchId = req.params.branchId;
    const prefix = utils.isEmptyOrWhitespace(req.body.prefix) ? null : req.body.prefix;

    const branch = becca.getBranch(branchId);
    branch.prefix = prefix;
    branch.save();
}

module.exports = {
    moveBranchToParent,
    moveBranchBeforeNote,
    moveBranchAfterNote,
    setExpanded,
    setExpandedForSubtree,
    deleteBranch,
    setPrefix
};
