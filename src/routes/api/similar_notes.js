"use strict";

const similarityService = require('../../becca/similarity.js');
const becca = require('../../becca/becca.js');

function getSimilarNotes(req) {
    const noteId = req.params.noteId;

    const note = becca.getNoteOrThrow(noteId);

    return similarityService.findSimilarNotes(noteId);
}

module.exports = {
    getSimilarNotes
};
