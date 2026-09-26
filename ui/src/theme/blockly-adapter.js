/// CodeBridge Blockly 主題 adapter。
/// 集中管理 Blockly chrome、grid 與執行期 block palette，不修改 block type 或 XML contract。
(function() {
    'use strict';

    function getRoleColour(visualTheme, role) {
        if (!role) return null;
        return window.CodeBridgeBlockPalette.getColour(visualTheme, role);
    }

    function getTheme(visualTheme) {
        if (typeof Blockly === 'undefined' || !Blockly.Theme) return null;
        var isCandy = visualTheme === 'candy-light';
        var themeName = isCandy ? 'codebridge-candy-light' : 'codebridge-technology-dark';
        return Blockly.Theme.defineTheme(themeName, {
            base: Blockly.Themes.Classic,
            componentStyles: {
                toolboxBackground: isCandy ? '#ffffff' : '#121b2b',
                toolboxForeground: isCandy ? '#35324a' : '#e8f0f9',
                toolboxSelectedBackground: isCandy ? '#ffe1ef' : '#203149',
                flyoutBackground: isCandy ? '#ffffff' : '#121b2b',
                flyoutForeground: isCandy ? '#35324a' : '#e8f0f9',
                flyoutOpacity: 1,
                selectedGlow: isCandy ? '#7b61c9' : '#35c7d4',
                insertionMarkerColour: isCandy ? '#e94f91' : '#35c7d4',
                insertionMarkerOpacity: 0.4,
                blockGlowColour: isCandy ? '#e94f91' : '#35c7d4',
                blockGlowOpacity: 0.35,
                workspaceBackgroundColour: isCandy ? '#fff7fb' : '#0c121f',
                insertionColour: getRoleColour(visualTheme, 'control') || '#0f8fa8'
            }
        });
    }

    function getGridColour() {
        return getComputedStyle(document.documentElement).getPropertyValue('--cb-blockly-grid').trim() || '#ddd';
    }

    /**
     * 依 block type 的語意角色重新著色。
     * 未登錄語意角色的第三方積木保持原色，不影響 block type、XML 與 generator contract。
     */
    function applyBlockColours(visualTheme, workspace) {
        var palette = window.CodeBridgeBlockPalette;
        if (!workspace) return;
        workspace.getAllBlocks(false).forEach(function(block) {
            var colour = palette.getColour(visualTheme, palette.getRoleForBlockType(block.type));
            if (colour && typeof block.setColour === 'function') {
                block.setColour(colour);
            }
        });
    }

    function applyToolboxColours(visualTheme, workspace) {
        var toolboxXml = document.getElementById('toolbox-xml');
        var palette = window.CodeBridgeBlockPalette;
        if (!toolboxXml) return;
        var activeToolbox = toolboxXml.cloneNode(true);

        // 積木節點以 block type 查語意角色。
        activeToolbox.querySelectorAll('block').forEach(function(node) {
            var colour = palette.getColour(visualTheme, palette.getRoleForBlockType(node.getAttribute('type')));
            if (colour) node.setAttribute('colour', colour);
        });

        // 分類色塊優先對齊分類內第一個積木的語意角色，
        // dynamic 分類（Variables）沒有固定 block，改以分類語意決定。
        activeToolbox.querySelectorAll('category').forEach(function(categoryNode) {
            var firstBlockNode = categoryNode.querySelector('block');
            var role = firstBlockNode
                ? palette.getRoleForBlockType(firstBlockNode.getAttribute('type'))
                : null;
            if (!role) role = palette.getRoleForCategoryName(categoryNode.getAttribute('name'));
            var categoryColour = palette.getColour(visualTheme, role);
            if (categoryColour) categoryNode.setAttribute('colour', categoryColour);
        });

        if (workspace && typeof workspace.updateToolbox === 'function') {
            workspace.updateToolbox(activeToolbox);
        }
    }

    function applyPalette(visualTheme, workspace) {
        applyBlockColours(visualTheme, workspace);
        applyToolboxColours(visualTheme, workspace);
    }

    window.CodeBridgeBlocklyTheme = {
        getTheme: getTheme,
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
