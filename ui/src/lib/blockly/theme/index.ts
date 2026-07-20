/// CodeBridge Blockly 主題定義

export function getDefaultTheme(): any {
  return {
    'name': 'CodeBridge',
    'base': Blockly.Themes.Classic,
    'componentStyles': {
      'workspaceBackgroundColour': '#1e1e1e',
      'toolboxBackgroundColour': '#252526',
      'toolboxForegroundColour': '#cccccc',
      'flyoutBackgroundColour': '#2d2d2d',
      'flyoutForegroundColour': '#cccccc',
      'flyoutOpacity': 1,
      'scrollbarColour': '#424242',
      'insertionMarkerColour': '#ffffff',
      'insertionMarkerOpacity': 0.3,
    },
    'fontStyle': {
      'family': 'Consolas, "Courier New", monospace',
      'weight': 'normal',
      'size': 12,
    },
  };
}