/// CodeBridge Modules 語意積木 palette contract。
/// 顏色由語意角色（role）決定，是模組色碼的唯一來源。
/// 第三方模組可用 registerModule() 以語意角色加入 Engineer／Angel preset。
(function() {
    'use strict';

    var DEFAULT_VISUAL_THEME = 'technology-dark';

    // 語意角色 → 各 visual theme 的色碼。角色名稱不綁定任何模組語言。
    var ROLE_COLOURS = {
        structure: { 'technology-dark': '#4f6075', 'candy-light': '#756bb1' },
        control: { 'technology-dark': '#0f8fa8', 'candy-light': '#f062a4' },
        digital: { 'technology-dark': '#22a06b', 'candy-light': '#3fbf91' },
        analog: { 'technology-dark': '#d97706', 'candy-light': '#f59e0b' },
        time: { 'technology-dark': '#6d5bd0', 'candy-light': '#8b5cf6' },
        serial: { 'technology-dark': '#1d7fd8', 'candy-light': '#38bdf8' },
        logic: { 'technology-dark': '#7b61c9', 'candy-light': '#a78bfa' },
        loops: { 'technology-dark': '#168a72', 'candy-light': '#34d399' },
        math: { 'technology-dark': '#4169a1', 'candy-light': '#818cf8' },
        text: { 'technology-dark': '#477b68', 'candy-light': '#4fd1a5' },
        variables: { 'technology-dark': '#c65d6f', 'candy-light': '#fb7185' },
        array: { 'technology-dark': '#b07a1c', 'candy-light': '#fbbf24' },
        functions: { 'technology-dark': '#b5447c', 'candy-light': '#ec4899' }
    };


    // block type 前綴 → 語意角色。第三方模組以相同機制加入。
    var TYPE_PREFIX_ROLES = {
        initializes_: 'structure',
        coding_: 'structure',
        arduino_pin_mode: 'control',
        arduino_digital_: 'digital',
        arduino_analog_: 'analog',
        arduino_delay: 'time',
        arduino_millis: 'time',
        arduino_micros: 'time',
        arduino_serial_: 'serial',
        controls_: 'logic',
        logic_: 'logic',
        math_: 'math',
        arduino_constrain: 'math',
        arduino_map: 'math',
        text_: 'text',
        variables_: 'variables',
        array_: 'array',
        custom_functions_: 'functions'
    };

    // 精確 block type → 語意角色（優先於前綴規則）。
    var TYPE_ROLES = {
        arduino_pin_shadow: 'digital',
        controls_for: 'loops',
        controls_while: 'loops',
        controls_flow_statements: 'loops',
        text: 'text',
        text_join: 'text'
    };

    // Toolbox 分類 → 語意角色。dynamic 分類沒有固定 block，以分類語意決定。
    var CATEGORY_ROLES = {
        ARDUINO_CATEGORY: 'control',
        ARDUINO_STRUCTURE_CATEGORY: 'structure',
        ARDUINO_IO_CATEGORY: 'digital',
        ARDUINO_TIME_CATEGORY: 'time',
        ARDUINO_SERIAL_CATEGORY: 'serial',
        CODING_CATEGORY: 'structure',
        LOGIC_CATEGORY: 'logic',
        LOOPS_CATEGORY: 'loops',
        MATH_CATEGORY: 'math',
        TEXT_CATEGORY: 'text',
        VARIABLES_CATEGORY: 'variables',
        ARRAY_CATEGORY: 'array',
        FUNCTIONS_CATEGORY: 'functions'
    };

    var registeredPrefixRoles = Object.create(null);
    var registeredExactRoles = Object.create(null);

    function has(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function getColour(visualTheme, role) {
        var theme = has(ROLE_COLOURS, role) ? ROLE_COLOURS[role] : null;
        if (!theme) return null;
        return theme[visualTheme] || theme[DEFAULT_VISUAL_THEME] || null;
    }

    function getRoleForBlockType(blockType) {
        if (!blockType) return null;
        if (has(registeredExactRoles, blockType)) return registeredExactRoles[blockType];
        if (has(TYPE_ROLES, blockType)) return TYPE_ROLES[blockType];
        var prefixes = Object.keys(registeredPrefixRoles);
        for (var i = 0; i < prefixes.length; i++) {
            if (blockType.indexOf(prefixes[i]) === 0) return registeredPrefixRoles[prefixes[i]];
        }
        for (var key in TYPE_PREFIX_ROLES) {
            if (has(TYPE_PREFIX_ROLES, key) && blockType.indexOf(key) === 0) return TYPE_PREFIX_ROLES[key];
        }
        return null;
    }

    function getRoleForCategoryName(categoryName) {
        if (!categoryName) return null;
        var match = /BKY_([A-Z0-9_]+_CATEGORY)/.exec(String(categoryName));
        if (match && has(CATEGORY_ROLES, match[1])) return CATEGORY_ROLES[match[1]];
        return null;
    }

    /**
     * 註冊第三方模組的語意角色。
     * @param {{id: string, role: string, typePrefix?: string, blockTypes?: string[], colours: Object}} manifest
     */
    function registerModule(manifest) {
        if (!manifest || !manifest.id || !manifest.role) return null;
        var role = manifest.role;
        if (manifest.colours) {
            var fallback = manifest.colours[DEFAULT_VISUAL_THEME] || null;
            ROLE_COLOURS[role] = {
                'technology-dark': manifest.colours['technology-dark'] || fallback,
                'candy-light': manifest.colours['candy-light'] || fallback
            };
        }
        if (manifest.typePrefix) {
            registeredPrefixRoles[manifest.typePrefix] = role;
        }
        (manifest.blockTypes || []).forEach(function(blockType) {
            registeredExactRoles[blockType] = role;
        });
        return role;
    }

    /**
     * 讀取 toolbox 分類的語意角色清單，供分類色塊與第三方分類對齊使用。
     * @returns {Array<{name: string, role: string|null}>}
     */
    function getCategories() {
        var toolbox = document.getElementById('toolbox-xml');
        if (!toolbox) return [];
        return Array.from(toolbox.querySelectorAll('category')).map(function(node) {
            var role = getRoleForCategoryName(node.getAttribute('name'));
            if (!role) {
                var firstBlock = node.querySelector('block');
                if (firstBlock) role = getRoleForBlockType(firstBlock.getAttribute('type'));
            }
            return { name: node.getAttribute('name'), role: role };
        });
    }

    /**
     * block 定義於 jsonInit 後呼叫，取目前 preset 的語意色碼。
     * @param {string} role 語意角色
     * @returns {string|null}
     */
    function getColourForRole(role) {
        var visualTheme = window.CodeBridgeTheme
            ? window.CodeBridgeTheme.getDefinition().visualTheme
            : DEFAULT_VISUAL_THEME;
        return getColour(visualTheme, role);
    }

    window.CodeBridgeBlockPalette = {
        ROLES: ROLE_COLOURS,
        getColour: getColour,
        getColourForRole: getColourForRole,
        getRoleForBlockType: getRoleForBlockType,
        getRoleForCategoryName: getRoleForCategoryName,
        getCategories: getCategories,
        registerModule: registerModule
    };
})();
