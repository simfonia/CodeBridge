/// CodeBridge Coding 模組 - 積木定義
/// 提供註解、引入、原始陳述式/定義/輸入/包裹功能

// ============================================================
// 註冊 field_multilineinput 
// field-multilineinput.js 插件註冊為 field_multilinetext，
// 需手動註冊為 field_multilineinput 供積木使用
// ============================================================
if (typeof Blockly !== 'undefined' && typeof FieldMultilineInput !== 'undefined') {
    Blockly.fieldRegistry.register('field_multilineinput', FieldMultilineInput);
}

// ============================================================
// coding_comment - C++ 註解
// ============================================================
Blockly.Blocks['coding_comment'] = {
    init: function() {
        this.jsonInit({
            type: 'coding_comment',
            message0: '%{BKY_CODING_COMMENT}',
            args0: [
                {
                    type: 'field_input',
                    name: 'COMMENT',
                    text: ''
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: '%{BKY_CODING_HUE}',
            tooltip: '%{BKY_CODING_COMMENT_TOOLTIP}',
            helpUrl: ''
        });
    }
};

// ============================================================
// coding_include - #include 函式庫引用
// ============================================================
Blockly.Blocks['coding_include'] = {
    init: function() {
        this.jsonInit({
            type: 'coding_include',
            message0: '%{BKY_CODING_INCLUDE}',
            args0: [
                {
                    type: 'field_input',
                    name: 'INCLUDE',
                    text: ''
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: '%{BKY_CODING_HUE}',
            tooltip: '%{BKY_CODING_INCLUDE_TOOLTIP}',
            helpUrl: ''
        });
    }
};

// ============================================================
// coding_raw_statement - 原始 C++ 陳述式
// ============================================================
Blockly.Blocks['coding_raw_statement'] = {
    init: function() {
        this.jsonInit({
            type: 'coding_raw_statement',
            message0: '%{BKY_CODING_RAW_STATEMENT}',
            args0: [
                {
                    type: 'field_multilineinput',
                    name: 'CODE',
                    text: ''
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: '%{BKY_CODING_HUE}',
            tooltip: '%{BKY_CODING_RAW_STATEMENT_TOOLTIP}',
            helpUrl: ''
        });
    }
};

// ============================================================
// coding_raw_input - 原始 C++ 表達式 (值積木)
// ============================================================
Blockly.Blocks['coding_raw_input'] = {
    init: function() {
        this.jsonInit({
            type: 'coding_raw_input',
            message0: '%{BKY_CODING_RAW_INPUT}',
            args0: [
                {
                    type: 'field_input',
                    name: 'CODE',
                    text: ''
                }
            ],
            output: true,
            colour: '%{BKY_CODING_HUE}',
            tooltip: '%{BKY_CODING_RAW_INPUT_TOOLTIP}',
            helpUrl: ''
        });
    }
};

// ============================================================
// coding_raw_definition - 全局作用域原始程式碼
// ============================================================
Blockly.Blocks['coding_raw_definition'] = {
    init: function() {
        this.jsonInit({
            type: 'coding_raw_definition',
            message0: '%{BKY_CODING_RAW_DEFINITION}',
            args0: [
                {
                    type: 'field_multilineinput',
                    name: 'CODE',
                    text: ''
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: '%{BKY_CODING_HUE}',
            tooltip: '%{BKY_CODING_RAW_DEFINITION_TOOLTIP}',
            helpUrl: ''
        });
    }
};

// ============================================================
// coding_raw_wrapper - 原始 C++ 包裹 (容器型)
// ============================================================
Blockly.Blocks['coding_raw_wrapper'] = {
    init: function() {
        this.jsonInit({
            type: 'coding_raw_wrapper',
            message0: '%{BKY_CODING_RAW_WRAPPER}',
            args0: [
                {
                    type: 'field_multilineinput',
                    name: 'HEADER',
                    text: ''
                },
                {
                    type: 'input_statement',
                    name: 'CONTENT'
                },
                {
                    type: 'field_multilineinput',
                    name: 'FOOTER',
                    text: ''
                }
            ],
            previousStatement: true,
            nextStatement: true,
            colour: '%{BKY_CODING_HUE}',
            tooltip: '%{BKY_CODING_RAW_WRAPPER_TOOLTIP}',
            helpUrl: ''
        });
    }
};