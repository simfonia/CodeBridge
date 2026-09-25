/// CodeBridge Experience Theme manager。
/// 對外只暴露 preset；內部再協調 visual theme 與 block style。
(function() {
    'use strict';

    var DEFAULT_PRESET = 'engineer';
    var PRESET_KEY = 'codebridgeExperiencePreset';
    var LEGACY_STYLE_KEY = 'codebridgeTheme';
    var STYLE_KEY = 'codebridgeBlockStyle';
    var currentPreset = DEFAULT_PRESET;

    function isSupported(preset) {
        return Object.prototype.hasOwnProperty.call(CODEBRIDGE_EXPERIENCE_PRESETS, preset);
    }

    function readStoredPreset() {
        var stored = localStorage.getItem(PRESET_KEY);
        if (isSupported(stored)) return stored;

        var legacyStyle = localStorage.getItem(LEGACY_STYLE_KEY);
        if (legacyStyle === 'angel' || legacyStyle === 'engineer') {
            localStorage.setItem(PRESET_KEY, legacyStyle);
            localStorage.setItem(STYLE_KEY, legacyStyle);
            return legacyStyle;
        }
        return DEFAULT_PRESET;
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
        localStorage.setItem(STYLE_KEY, CODEBRIDGE_EXPERIENCE_PRESETS[currentPreset].blockStyle);
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
        localStorage.setItem(STYLE_KEY, CODEBRIDGE_EXPERIENCE_PRESETS[nextPreset].blockStyle);
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
