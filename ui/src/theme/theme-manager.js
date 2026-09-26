/// CodeBridge Experience Theme manager。
/// 對外只暴露 preset；內部再協調 visual theme 與 block style。
(function() {
    'use strict';

    var DEFAULT_PRESET = 'engineer';
    var PRESET_KEY = 'codebridgeExperiencePreset';
    var currentPreset = DEFAULT_PRESET;

    function isSupported(preset) {
        return Object.prototype.hasOwnProperty.call(CODEBRIDGE_EXPERIENCE_PRESETS, preset);
    }

    function readStoredPreset() {
        var stored = localStorage.getItem(PRESET_KEY);
        return isSupported(stored) ? stored : DEFAULT_PRESET;
    }

    function applyVisualTheme(preset) {
        var definition = CODEBRIDGE_EXPERIENCE_PRESETS[preset];
        document.documentElement.dataset.codebridgePreset = preset;
        if (window.CodeBridgeCodeTheme) {
            window.CodeBridgeCodeTheme.apply(definition.visualTheme);
        }
    }

    function init() {
        currentPreset = readStoredPreset();
        localStorage.setItem(PRESET_KEY, currentPreset);
        applyVisualTheme(currentPreset);
        return currentPreset;
    }

    function attachWorkspace(workspace) {
        var definition = CODEBRIDGE_EXPERIENCE_PRESETS[currentPreset];
        if (window.CodeBridgeBlocklyTheme) {
            window.CodeBridgeBlocklyTheme.apply(definition.visualTheme, workspace);
        }
    }

    function setPreset(preset) {
        var nextPreset = isSupported(preset) ? preset : DEFAULT_PRESET;
        currentPreset = nextPreset;
        localStorage.setItem(PRESET_KEY, nextPreset);
        applyVisualTheme(nextPreset);

        var workspace = typeof Blockly !== 'undefined' && typeof Blockly.getMainWorkspace === 'function'
            ? Blockly.getMainWorkspace()
            : null;
        if (typeof window.setBlockStyle === 'function') {
            window.setBlockStyle(CODEBRIDGE_EXPERIENCE_PRESETS[nextPreset].blockStyle);
        }
        attachWorkspace(workspace);
        return nextPreset;
    }

    window.CodeBridgeTheme = {
        init: init,
        attachWorkspace: attachWorkspace,
        setPreset: setPreset,
        getPreset: function() { return currentPreset; },
        getDefinition: function(preset) { return CODEBRIDGE_EXPERIENCE_PRESETS[preset || currentPreset]; }
    };
})();
