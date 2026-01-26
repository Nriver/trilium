import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import jsonc from "eslint-plugin-jsonc";
import jsoncParser from "jsonc-eslint-parser";

export default [
    // 基础推荐规则
    js.configs.recommended,

    // Prettier 放在靠后位置，关闭与 prettier 冲突的规则
    prettier,

    // JSON / JSONC / JSON5 文件支持（相当于原来的 plugin:jsonc/recommended-with-jsonc）
    {
        files: ["**/*.json", "**/*.json5", "**/*.jsonc"],
        languageOptions: {
            parser: jsoncParser,
        },
        plugins: {
            jsonc,
        },
        rules: {
            ...jsonc.configs["recommended-with-jsonc"].rules,
            // 你原来在 package.json 里关闭了 sort-keys，这里也关闭
            "jsonc/sort-keys": "off",
        },
    },

    // 针对 package.json 的特殊规则（如果你有更多 package.json 定制可以加在这里）
    {
        files: ["package.json"],
        languageOptions: {
            parser: jsoncParser,
        },
        rules: {
            "jsonc/sort-keys": "off", // 保持关闭
        },
    },

    // 全局语言选项：ecmaVersion、sourceType、globals
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,

                // 你原来定义的自定义 globals，全复制过来了
                $: "readonly",
                jQuery: "readonly",
                glob: "readonly",
                log: "readonly",
                EditorWatchdog: "readonly",
                React: "readonly",
                appState: "readonly",
                ExcalidrawLib: "readonly",
                elements: "readonly",
                files: "readonly",
                ReactDOM: "readonly",
                jsPlumb: "readonly",
                panzoom: "readonly",
                logError: "readonly",
                WZoom: "readonly",
                renderMathInElement: "readonly",
                BalloonEditor: "readonly",
                FancytreeNode: "readonly",
                CKEditorInspector: "readonly",
                CodeMirror: "readonly",
                Split: "readonly",
                mermaid: "readonly",
                dayjs: "readonly",
                ForceGraph: "readonly",
                ko: "readonly",
                syncInProgress: "readonly",
                logInfo: "readonly",
                __non_webpack_require__: "readonly",

                // 测试相关（jasmine/mocha 等）
                describe: "readonly",
                it: "readonly",
                expect: "readonly",
            },
        },
    },

    // 自定义规则（你原来几乎把 Airbnb 的严格规则都关掉了，这里保持一致）
    {
        rules: {
            // eslint:recommended 中你关闭的
            "no-unused-vars": "off",
            "linebreak-style": "off",
            "no-useless-escape": "off",
            "no-empty": "off",
            "no-constant-condition": "off",
            "getter-return": "off",
            "no-cond-assign": "off",
            "no-async-promise-executor": "off",
            "no-extra-semi": "off",
            "no-inner-declarations": "off",

            // prettier 相关（你原来是 off）
            "prettier/prettier": "off",

            // airbnb-base 中你关闭的规则（几乎全 off）
            "no-console": "off",
            "no-plusplus": "off",
            "no-param-reassign": "off",
            "global-require": "off",
            "no-use-before-define": "off",
            "no-await-in-loop": "off",
            radix: "off",
            "import/order": "off",
            "import/no-extraneous-dependencies": "off",
            "prefer-destructuring": "off",
            "no-shadow": "off",
            "no-new": "off",
            "no-restricted-syntax": "off",
            strict: "off",
            "class-methods-use-this": "off",
            "no-else-return": "off",
            "import/no-dynamic-require": "off",
            "no-underscore-dangle": "off",
            "prefer-template": "off",
            "consistent-return": "off",
            "no-continue": "off",
            "object-shorthand": "off",
            "one-var": "off",
            "prefer-const": "off",
            "spaced-comment": "off",
            "no-loop-func": "off",
            "arrow-body-style": "off",
            "guard-for-in": "off",
            "no-return-assign": "off",
            "dot-notation": "off",
            "func-names": "off",
            "import/no-useless-path-segments": "off",
            "default-param-last": "off",
            "prefer-arrow-callback": "off",
            "no-unneeded-ternary": "off",
            "no-return-await": "off",
            "import/extensions": "off",
            "no-var": "off",
            "import/newline-after-import": "off",
            "no-restricted-globals": "off",
            "operator-assignment": "off",
            "no-eval": "off",
            "max-classes-per-file": "off",
            "vars-on-top": "off",
            "no-bitwise": "off",
            "no-lonely-if": "off",
            "no-multi-assign": "off",
            "no-promise-executor-return": "off",
            "no-empty-function": "off",
            "import/no-unresolved": "off",
            camelcase: "off",
            eqeqeq: "off",
            "lines-between-class-members": "off",
            "import/no-cycle": "off",
            "new-cap": "off",
            "prefer-object-spread": "off",
            "no-new-func": "off",
            "no-unused-expressions": "off",
            "lines-around-directive": "off",
            "prefer-exponentiation-operator": "off",
            "no-restricted-properties": "off",
            "prefer-rest-params": "off",
            "no-unreachable-loop": "off",
            "no-alert": "off",
            "no-useless-return": "off",
            "no-nested-ternary": "off",
            "prefer-regex-literals": "off",
            "import/no-named-as-default-member": "off",
            yoda: "off",
            "no-script-url": "off",
            "no-prototype-builtins": "off",

            // 如果以后想开启一些规则，可以在这里改成 "warn" 或 "error"
        },
    },
];
