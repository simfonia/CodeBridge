/// CodeBridge Blockly 主題 adapter。
/// 集中管理 Blockly chrome、grid 與執行期 block palette，不修改 block type 或 XML contract。
(function() {
    'use strict';

    var PALETTES = {
        'technology-dark': {
            ARDUINO_STRUCTURE_HUE: '#4f6075',
            ARDUINO_CONTROL_HUE: '#0f8fa8',
            ARDUINO_DIGITAL_IO_HUE: '#22a06b',
            ARDUINO_ANALOG_IO_HUE: '#d97706',
            ARDUINO_TIME_HUE: '#6d5bd0',
            ARDUINO_SERIAL_HUE: '#1d7fd8',
            CODING_HUE: '#4f6075',
            LOGIC_HUE: '#7b61c9',
            LOGIC_COMPARE_HUE: '#7b61c9',
            LOGIC_OPERATION_HUE: '#7b61c9',
            LOGIC_BOOLEAN_HUE: '#7b61c9',
            LOOPS_HUE: '#168a72',
            MATH_HUE: '#4169a1',
            TEXT_HUE: '#477b68',
            VARIABLES_HUE: '#c65d6f',
            ARRAY_HUE: '#b07a1c',
            FUNCTIONS_HUE: '#b5447c'
        },
        'candy-light': {
            ARDUINO_STRUCTURE_HUE: '#756bb1',
            ARDUINO_CONTROL_HUE: '#f062a4',
            ARDUINO_DIGITAL_IO_HUE: '#3fbf91',
            ARDUINO_ANALOG_IO_HUE: '#f59e0b',
            ARDUINO_TIME_HUE: '#8b5cf6',
            ARDUINO_SERIAL_HUE: '#38bdf8',
            CODING_HUE: '#756bb1',
            LOGIC_HUE: '#a78bfa',
            LOGIC_COMPARE_HUE: '#a78bfa',
            LOGIC_OPERATION_HUE: '#a78bfa',
            LOGIC_BOOLEAN_HUE: '#a78bfa',
            LOOPS_HUE: '#34d399',
            MATH_HUE: '#818cf8',
            TEXT_HUE: '#4fd1a5',
            VARIABLES_HUE: '#fb7185',
            ARRAY_HUE: '#fbbf24',
            FUNCTIONS_HUE: '#ec4899'
        }
    };

    function getPalette(visualTheme) {
        return PALETTES[visualTheme] || PALETTES['technology-dark'];
    }

    function getTheme(visualTheme) {
        if (typeof Blockly === 'undefined' || !Blockly.Theme) return null;
        var palette = getPalette(visualTheme);
        var themeName = visualTheme === 'candy-light' ? 'codebridge-candy-light' : 'codebridge-technology-dark';
        return Blockly.Theme.defineTheme(themeName, {
            base: Blockly.Themes.Classic,
            componentStyles: {
                toolboxBackground: visualTheme === 'candy-light' ? '#ffffff' : '#121b2b',
                toolboxForeground: visualTheme === 'candy-light' ? '#35324a' : '#e8f0f9',
                toolboxSelectedBackground: visualTheme === 'candy-light' ? '#ffe1ef' : '#203149',
                flyoutBackground: visualTheme === 'candy-light' ? '#ffffff' : '#121b2b',
                flyoutForeground: visualTheme === 'candy-light' ? '#35324a' : '#e8f0f9',
                flyoutOpacity: 1,
                selectedGlow: visualTheme === 'candy-light' ? '#7b61c9' : '#35c7d4',
                insertionMarkerColour: visualTheme === 'candy-light' ? '#e94f91' : '#35c7d4',
                insertionMarkerOpacity: 0.4,
                blockGlowColour: visualTheme === 'candy-light' ? '#e94f91' : '#35c7d4',
                blockGlowOpacity: 0.35,
                workspaceBackgroundColour: visualTheme === 'candy-light' ? '#fff7fb' : '#0c121f',
                insertionColour: palette.ARDUINO_CONTROL_HUE
            }
        });
    }

    function getGridColour() {
        return getComputedStyle(document.documentElement).getPropertyValue('--cb-blockly-grid').trim() || '#ddd';
    }

    function applyPalette(visualTheme, workspace) {
        var palette = getPalette(visualTheme);
        var sourceColours = {};
        Object.keys(palette).forEach(function(key) {
            var messageKey = key;
            if (typeof Blockly !== 'undefined' && Blockly.Msg && Blockly.Msg[messageKey]) {
                sourceColours[Blockly.Msg[messageKey].toLowerCase()] = palette[messageKey];
            }
            if (typeof Blockly !== 'undefined' && Blockly.Msg) {
                Blockly.Msg[messageKey] = palette[messageKey];
                Blockly.Msg['BKY_' + messageKey] = palette[messageKey];
            }
        });

        if (workspace) {
            workspace.getAllBlocks(false).forEach(function(block) {
                var paletteColour = sourceColours[String(block.getColour()).toLowerCase()];
                if (paletteColour && typeof block.setColour === 'function') {
                    block.setColour(paletteColour);
                }
            });
        }

        var toolboxXml = document.getElementById('toolbox-xml');
        if (toolboxXml) {
            var activeToolbox = toolboxXml.cloneNode(true);
            activeToolbox.querySelectorAll('[colour]').forEach(function(node) {
                var paletteColour = sourceColours[String(node.getAttribute('colour')).toLowerCase()];
                if (paletteColour) node.setAttribute('colour', paletteColour);
            });

            // 分類色塊對齊分類內第一個積木的實際 colour。
            // 只處理含有 block 的分類；Variables dynamic 等無固定 block 的分類保持原色。
            if (workspace) {
                activeToolbox.querySelectorAll('category').forEach(function(categoryNode) {
                    var firstBlockNode = categoryNode.querySelector('block');
                    if (!firstBlockNode) return;
                    var temporaryBlock = null;
                    try {
                        temporaryBlock = workspace.newBlock(firstBlockNode.getAttribute('type'));
                        categoryNode.setAttribute('colour', temporaryBlock.getColour());
                    } catch (error) {
                        console.warn('[CodeBridge] Unable to align toolbox category colour:', error);
                    } finally {
                        if (temporaryBlock) temporaryBlock.dispose(false);
                    }
                });
            }

            if (workspace && typeof workspace.updateToolbox === 'function') {
                workspace.updateToolbox(activeToolbox);
            }
        }
    }

    window.CodeBridgeBlocklyTheme = {
        getTheme: getTheme,
        getPalette: getPalette,
        getGridColour: getGridColour,
        applyPalette: applyPalette,
        apply: function(visualTheme, workspace) {
            var theme = getTheme(visualTheme);
            if (theme && workspace && typeof workspace.setTheme === 'function') {
                workspace.setTheme(theme);
            }
            applyPalette(visualTheme, workspace);
            if (workspace) {
                Blockly.Events.disable();
                try {
                    Blockly.setLocale(Blockly.Msg);
                } finally {
                    Blockly.Events.enable();
                }
                workspace.updateAriaLabel();
            }
            return theme;
        }
    };
})();
