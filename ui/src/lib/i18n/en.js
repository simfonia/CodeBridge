/// CodeBridge UI Translations - English
/// Only toolbar, menu, dialog UI text
/// Block text, category names, colors, tooltips belong to blockly/messages/

var UI_EN = {
    // Toolbar
    TLB_FILE_NEW: 'Untitled Project',
    TLB_NEW: 'New',
    TLB_OPEN: 'Open',
    TLB_SAVE: 'Save',
    TLB_SAVE_AS: 'Save As',
    TLB_SETTINGS: 'Settings',
    TLB_DIAGNOSE: 'Diagnose',
    TLB_SERIAL_REFRESH: 'Refresh Serial Ports',
    TLB_SERIAL_PORT: 'Serial Port',
    TLB_NO_PORT: 'No serial port detected',
    TLB_RUN: 'Run',
    TLB_STOP_PROGRAM: 'Stop Program',
    TLB_TERMINAL: 'Terminal',
    TLB_TERMINAL_TITLE: 'Serial Monitor',
    TLB_PAUSE_SCROLL: 'Pause Scroll',
    TLB_CLEAR_CONSOLE: 'Clear Console',
    TLB_CLOSE_PANEL: 'Close Panel',
    TLB_TOGGLE_CODE: 'Toggle Code',
    TLB_ARDUINO_PREVIEW: 'Arduino Code Preview',
    TLB_DRAG_RESIZE: 'Drag to Resize',
    TLB_COPY_CODE: 'Copy Code',
    TLB_EXAMPLES: 'Examples',
    TLB_THEME_TOGGLE: 'Switch Experience (Engineer/Angel)',
    TLB_LANG_TOGGLE: 'Switch Language (中文/English)',
    TLB_BLOCK_SEARCH: 'Search blocks',
    TLB_BLOCK_SEARCH_PLACEHOLDER: 'Search blocks...',
    TLB_BLOCK_SEARCH_CLEAR: 'Clear block search',
    TLB_BLOCK_SEARCH_NO_RESULTS: 'No matching blocks',
    
    // Arduino CLI toolchain (Plan B: external dependency + guided install)
    CLI_PANEL_TITLE: 'Arduino CLI Toolchain',
    CLI_DETECTING: 'Detecting Arduino CLI...',
    CLI_FOUND: 'Arduino CLI detected',
    CLI_NOT_FOUND: 'Arduino CLI is not installed',
    CLI_NOT_FOUND_HINT: 'Install Arduino CLI to compile and upload programs.',
    CLI_INSTALL_COMMAND: 'Install command',
    CLI_DOWNLOAD_PAGE: 'Download guide',
    CLI_VERSION: 'Version',
    CLI_PATH: 'Executable path',
    CLI_CONFIG_DIR: 'Config directory',
    CLI_DATA_DIR: 'Data directory',
    CLI_USER_DIR: 'User directory',
    CLI_SET_CUSTOM_PATH: 'Set executable path',
    CLI_CLEAR_CUSTOM_PATH: 'Use system PATH',
    CLI_SOURCE_USER_CONFIGURED: 'User specified',
    CLI_SOURCE_SYSTEM_PATH: 'System PATH',
    CLI_ERROR_CONFIGURED_PATH_MISSING: 'The configured Arduino CLI path does not exist',
    CLI_ERROR_NOT_FOUND: 'Arduino CLI not found. Please install it first.',
    CLI_ERROR_SPAWN_FAILED: 'Failed to launch Arduino CLI',
    CLI_ERROR_COMMAND_FAILED: 'Arduino CLI command failed',
    CLI_ERROR_INVALID_JSON: 'Could not parse the Arduino CLI response',
    
    // Compile diagnostics
    CLI_DIAGNOSTIC_ERROR: 'Error',
    CLI_DIAGNOSTIC_WARNING: 'Warning',
    CLI_DIAGNOSTIC_NOTE: 'Note',
    
    // Long-running operations
    CLI_OPERATION_COMPILE: 'Compile',
    CLI_OPERATION_UPLOAD: 'Upload',
    CLI_OPERATION_CORE_INSTALL: 'Install board core',
    CLI_OPERATION_CORE_UPDATE_INDEX: 'Update core index',
    CLI_OPERATION_LIBRARY_INSTALL: 'Install library',
    CLI_OPERATION_CANCEL: 'Cancel',
    CLI_OPERATION_RUNNING: 'Running...',
    CLI_OPERATION_SUCCEEDED: 'Done',
    CLI_OPERATION_FAILED: 'Failed',
    CLI_OPERATION_CANCELLED: 'Cancelled',
    CLI_OPERATION_TIMED_OUT: 'Timed out',
    
    // Not yet implemented stages
    SERIAL_MONITOR_NOT_IMPLEMENTED: 'Serial monitor will be available in a later stage',
    COMPILE_NOT_IMPLEMENTED: 'Compilation will be available in a later stage',
    
    // Practice Mode
    PRACTICE_ENTER: '✍️ Practice',
    PRACTICE_EXIT: '❌ Exit Practice',
    PRACTICE_TITLE: '✍️ Code Writing Practice',
    PRACTICE_HINT: '💡 F2 Hint | Enter Check | Esc Exit',
    PRACTICE_PLACEHOLDER: 'Write your code here...',
    PRACTICE_HINT_TITLE: '💡 Hint',
    PRACTICE_CHEAT: 'View Full Answer',
    PRACTICE_CHEAT_CLOSE: 'Close Full Answer',
    PRACTICE_ANSWER_TITLE: '📄 Full Answer',
    PRACTICE_READONLY_HINT: 'Exit practice mode to edit blocks',
    PRACTICE_COMPLETE: '🎉 Complete! All code is correct!',
    
    // Messages
    MSG_SAVE: 'Save',
    MSG_DONT_SAVE: 'Don\'t Save',
    MSG_CANCEL: 'Cancel',
    MSG_CLOSE: 'Close'
};