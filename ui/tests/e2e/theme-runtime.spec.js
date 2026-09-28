import { expect, test } from '@playwright/test';

test('uses the dark Engineer experience preset by default', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => ({
    preset: document.documentElement.dataset.codebridgePreset,
    blockStyle: window.CodeBridgeTheme?.getPreset(),
    background: getComputedStyle(document.body).backgroundColor,
    textColor: getComputedStyle(document.body).color
  }));

  expect(result.preset).toBe('engineer');
  expect(result.blockStyle).toBe('engineer');
  expect(result.background).toBe('rgb(12, 18, 31)');
  expect(result.textColor).toBe('rgb(232, 240, 249)');
});

test('switches to the bright Angel experience preset', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  await page.evaluate(() => window.CodeBridgeTheme.setPreset('engineer'));
  const engineerMessage = await page.evaluate(() => window.Blockly.Msg.VARIABLES_DECLARE_GLOBAL_MESSAGE);
  await page.locator('#btn-settings-root').click();
  await page.locator('#btn-theme-toggle').click();

  const result = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    return {
      preset: document.documentElement.dataset.codebridgePreset,
      visualTheme: document.documentElement.dataset.codebridgeVisualTheme,
      storedPreset: localStorage.getItem('codebridgeExperiencePreset'),
      message: window.Blockly.Msg.VARIABLES_DECLARE_GLOBAL_MESSAGE,
      background: getComputedStyle(document.body).backgroundColor,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--cb-primary').trim()
    };
  });

  expect(result.preset).toBe('angel');
  expect(result.visualTheme).toBe('candy-light');
  expect(result.storedPreset).toBe('angel');
  expect(result.message).not.toBe(engineerMessage);
  expect(result.background).toBe('rgb(255, 247, 251)');
  expect(result.primary).toBe('#e94f91');
});


test('preserves workspace state and generated code while switching presets', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  await page.waitForTimeout(50);
  const before = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    window.CodeBridgeBlocklyXml.textToWorkspace(
      '<xml><block type="initializes_setup" x="10" y="10"><value name="PIN"><shadow type="arduino_pin_shadow"><field name="PIN">2</field></shadow></value><next><block type="arduino_digital_write"><value name="PIN"><shadow type="arduino_pin_shadow"><field name="PIN">2</field></shadow></value><value name="STATE"><shadow type="arduino_digital_high"></shadow></value><next><block type="initializes_loop"></block></next></block></next></block></xml>',
      workspace
    );
    return {
      xml: Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)),
      code: Blockly.Arduino.workspaceToCode(workspace)
    };
  });

  await page.evaluate(() => window.CodeBridgeTheme.setPreset('angel'));
  const after = await page.evaluate(() => ({
    preset: window.CodeBridgeTheme.getPreset(),
    xml: Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(Blockly.getMainWorkspace())),
    code: Blockly.Arduino.workspaceToCode(Blockly.getMainWorkspace())
  }));

  expect(after.preset).toBe('angel');
  expect(after.xml).toBe(before.xml);
  expect(after.code).toBe(before.code);
});

test('restores a stored Angel preset after reload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'angel');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => ({
    preset: window.CodeBridgeTheme.getPreset(),
    checked: document.querySelector('#themeToggle').checked,
    background: getComputedStyle(document.body).backgroundColor
  }));

  expect(result.preset).toBe('angel');
  expect(result.checked).toBe(true);
  expect(result.background).toBe('rgb(255, 247, 251)');
});


test('applies each preset across the main application surfaces', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const engineer = await page.evaluate(() => ({
    toolbar: getComputedStyle(document.querySelector('#toolbar')).backgroundColor,
    codeArea: getComputedStyle(document.querySelector('#codeArea')).backgroundColor,
    codeContent: getComputedStyle(document.querySelector('#codeContent')).backgroundColor,
    toolbox: getComputedStyle(document.querySelector('.blocklyToolbox')).backgroundColor
  }));

  await page.evaluate(() => window.CodeBridgeTheme.setPreset('angel'));
  const angel = await page.evaluate(() => ({
    toolbar: getComputedStyle(document.querySelector('#toolbar')).backgroundColor,
    codeArea: getComputedStyle(document.querySelector('#codeArea')).backgroundColor,
    codeContent: getComputedStyle(document.querySelector('#codeContent')).backgroundColor,
    toolbox: getComputedStyle(document.querySelector('.blocklyToolbox')).backgroundColor
  }));

  expect(engineer).toEqual({
    toolbar: 'rgb(18, 27, 43)',
    codeArea: 'rgb(18, 27, 43)',
    codeContent: 'rgb(15, 23, 38)',
    toolbox: 'rgb(18, 27, 43)'
  });
  expect(angel).toEqual({
    toolbar: 'rgb(255, 255, 255)',
    codeArea: 'rgb(255, 255, 255)',
    codeContent: 'rgb(255, 250, 253)',
    toolbox: 'rgb(255, 255, 255)'
  });
});

test('starts with the Engineer block style as well as the visual preset', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => ({
    preset: window.CodeBridgeTheme.getPreset(),
    globalVariable: window.Blockly.Msg.VARIABLES_DECLARE_GLOBAL_MESSAGE,
    setupLabel: window.Blockly.Msg.INITIALIZES_SETUP_APPENDTEXT
  }));

  expect(result.preset).toBe('engineer');
  expect(result.globalVariable).toMatch(/^Global %1 %2 = %3$/);
  expect(result.setupLabel).toBe('void setup()');
});

test('stores only the experience preset without legacy migration keys', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeTheme', 'angel');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => ({
    preset: window.CodeBridgeTheme.getPreset(),
    storedPreset: localStorage.getItem('codebridgeExperiencePreset'),
    storedStyle: localStorage.getItem('codebridgeBlockStyle'),
    legacyKey: localStorage.getItem('codebridgeTheme'),
    checked: document.querySelector('#themeToggle').checked
  }));

  // 專案尚未發佈，不保留 codebridgeTheme 遷移；舊值既不讀取也不寫回。
  expect(result.preset).toBe('engineer');
  expect(result.storedPreset).toBe('engineer');
  expect(result.storedStyle).toBeNull();
  expect(result.checked).toBe(false);
  // 應用程式既不讀取也不清除舊鍵，僅單純忽略。
  expect(result.legacyKey).toBe('angel');
});

test('falls back safely when the stored preset is unknown', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'unknown-theme');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => ({
    preset: window.CodeBridgeTheme.getPreset(),
    storedPreset: localStorage.getItem('codebridgeExperiencePreset'),
    checked: document.querySelector('#themeToggle').checked
  }));

  expect(result.preset).toBe('engineer');
  expect(result.storedPreset).toBe('engineer');
  expect(result.checked).toBe(false);
});

test('uses a distinct Blockly block palette for each visual theme', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const engineerColour = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.newBlock('arduino_digital_write');
    block.initSvg();
    const colour = block.getColour();
    block.dispose(false);
    return colour;
  });

  await page.evaluate(() => window.CodeBridgeTheme.setPreset('angel'));
  const angelColour = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.newBlock('arduino_digital_write');
    block.initSvg();
    const colour = block.getColour();
    block.dispose(false);
    return colour;
  });

  expect(engineerColour).toBe('#22a06b');
  expect(angelColour).toBe('#3fbf91');
});

test('keeps the settings dropdown above the Blockly toolbox', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  await page.locator('#btn-settings-root').click();

  const result = await page.evaluate(() => {
    // 以設定按鈕所在的 dropdown 為準，不依賴文件中的第一個 .dropdown-content
    const dropdown = document.getElementById('btn-settings-root')
      .closest('.toolbar-dropdown')
      .querySelector('.dropdown-content');
    const rect = dropdown.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + 20, rect.top + 20);
    return {
      dropdownVisible: getComputedStyle(dropdown).display !== 'none',
      hitInsideDropdown: dropdown.contains(hit),
      hitTag: hit?.tagName,
      hitId: hit?.id ?? '',
      hitClassName: typeof hit?.className === 'string' ? hit.className : ''
    };
  });

  expect(result.dropdownVisible).toBe(true);
  expect(result.hitInsideDropdown).toBe(true);
});

test('keeps Engineer toolbox, flyout, highlight and switch visually aligned', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const hiddenCategories = Array.from(document.querySelectorAll('#toolbox-xml category'));
    const visibleCategories = Array.from(document.querySelectorAll('.blocklyToolboxCategory'));
    const categories = hiddenCategories.map((categoryNode, index) => {
      const firstBlockNode = categoryNode.querySelector('block');
      if (!firstBlockNode) return null;
      const firstBlock = workspace.newBlock(firstBlockNode.getAttribute('type'));
      const firstBlockColour = firstBlock.getColour();
      firstBlock.dispose(false);
      const swatch = getComputedStyle(visibleCategories[index]).borderLeftColor;
      return { swatch, firstBlockColour };
    }).filter(Boolean);
    const flyout = document.querySelector('.blocklyFlyout');
    const codeLine = document.querySelector('.code-line');
    return {
      categories,
      flyout: flyout ? getComputedStyle(flyout).backgroundColor : null,
      slider: document.querySelector('#themeToggle + .slider') ? getComputedStyle(document.querySelector('#themeToggle + .slider')).backgroundColor : null,
      knob: document.querySelector('#themeToggle + .slider') ? getComputedStyle(document.querySelector('#themeToggle + .slider'), '::before').backgroundColor : null,
      codeLineExists: Boolean(codeLine)
    };
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('#codeContent .code-line')?.classList.add('highlight-line'));
  await page.waitForFunction(() => {
    const line = document.querySelector('#codeContent .code-line.highlight-line');
    return line && getComputedStyle(line).backgroundColor === 'rgba(53, 199, 212, 0.14)';
  });
  const highlightStyles = await page.evaluate(() => {
    const codeLine = document.querySelector('#codeContent .code-line.highlight-line');
    return {
      background: getComputedStyle(codeLine).backgroundColor,
      border: getComputedStyle(codeLine).borderLeftColor
    };
  });

  const toRgb = (hex) => {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
    return `rgb(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)})`;
  };
  expect(result.categories.length).toBeGreaterThan(5);
  expect(result.categories.every(({ swatch, firstBlockColour }) => swatch === toRgb(firstBlockColour))).toBe(true);
  expect(result.flyout).toBe('rgb(18, 27, 43)');
  expect(highlightStyles.background).toBe('rgba(53, 199, 212, 0.14)');
  expect(highlightStyles.border).toBe('rgb(53, 199, 212)');
  expect(result.slider).toBe('rgb(48, 68, 95)');
  expect(result.knob).toBe('rgb(207, 232, 245)');
});

test('updates toolbox category names and search text across locale and preset changes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeLang', 'zh-hant');
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.() && window.CodeBridgeBlockSearch?.initialized);

  const readToolbox = (query) => page.evaluate((searchText) => ({
    labels: Array.from(document.querySelectorAll('.blocklyToolboxCategoryLabel')).map((node) => node.textContent.trim()),
    functionMatches: window.CodeBridgeBlockSearch.search(searchText).map((item) => item.type)
  }), query);

  const chineseEngineer = await readToolbox('void');
  expect(chineseEngineer.labels).toContain('Arduino');
  expect(chineseEngineer.functionMatches).toContain('custom_functions_defnoreturn');
  expect(chineseEngineer.labels.every((label) => !label.includes('%{BKY_'))).toBe(true);

  await page.evaluate(() => window.CodeBridgeTheme.setPreset('angel'));
  const chineseAngel = await readToolbox('建立函式');
  expect(chineseAngel.functionMatches).toContain('custom_functions_defnoreturn');

  await page.evaluate(() => {
    localStorage.setItem('codebridgeLang', 'en');
    location.reload();
  });
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.() && window.CodeBridgeBlockSearch?.initialized);

  const englishEngineer = await readToolbox('void');
  expect(englishEngineer.labels).toContain('Arduino');
  expect(englishEngineer.functionMatches).toContain('custom_functions_defnoreturn');
  expect(englishEngineer.labels.every((label) => !label.includes('%{BKY_'))).toBe(true);
});

test('hides the Engineer grid and shows Blockly zoom controls', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  const result = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    return {
      gridLength: workspace.options.gridOptions.length,
      zoomControls: Boolean(document.querySelector('.blocklyZoom')),
      zoomButtons: document.querySelectorAll('.blocklyZoom image, .blocklyZoom svg image').length
    };
  });
  expect(result.gridLength).toBe(0);
  expect(result.zoomControls).toBe(true);
  expect(result.zoomButtons).toBeGreaterThan(0);
});

test('updates existing workspace blocks when switching Engineer and Angel', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  const before = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.newBlock('arduino_digital_write');
    block.initSvg();
    return {
      message: window.Blockly.Msg.ARDUINO_DIGITAL_WRITE,
      text: block.getSvgRoot().querySelector('path.blocklyPath')?.getAttribute('aria-label') || '',
      blockId: block.id
    };
  });
  await page.evaluate(() => window.CodeBridgeTheme.setPreset('angel'));
  const after = await page.evaluate((blockId) => {
    const block = window.Blockly.getMainWorkspace().getBlockById(blockId);
    return {
      message: window.Blockly.Msg.ARDUINO_DIGITAL_WRITE,
      text: block?.getSvgRoot().querySelector('path.blocklyPath')?.getAttribute('aria-label') || ''
    };
  }, before.blockId);
  expect(after.message).not.toBe(before.message);
  expect(after.text).not.toBe(before.text);
});

test('exposes a semantic block palette manifest for every toolbox block type', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => {
    const palette = window.CodeBridgeBlockPalette;
    const missing = [];
    const roles = new Set();
    document.querySelectorAll('#toolbox-xml block').forEach((node) => {
      const type = node.getAttribute('type');
      const role = palette.getRoleForBlockType(type);
      if (!role) missing.push(type);
      else roles.add(role);
    });
    return {
      missing,
      roles: Array.from(roles).sort(),
      engineerSerial: palette.getColour('technology-dark', 'serial'),
      angelSerial: palette.getColour('candy-light', 'serial'),
      categories: palette.getCategories()
    };
  });

  expect(result.missing).toEqual([]);
  // Variables 改為固定 4 顆積木（對齊 piBlockly），故 block role 正式含 variables。
  // 原本用 `custom="VARIABLE"` 動態分類時，toolbox 內沒有固定 block，
  // 因此這個斷言刻意不含 'variables'。
  expect(result.roles).toEqual(
    expect.arrayContaining(['analog', 'array', 'control', 'digital', 'functions', 'logic', 'loops', 'math', 'serial', 'structure', 'text', 'time', 'variables'])
  );
  expect(result.engineerSerial).toBe('#1d7fd8');
  expect(result.angelSerial).toBe('#38bdf8');
  expect(result.categories.length).toBeGreaterThan(5);
  expect(result.categories.every((category) => category.role && category.role !== 'palette-unknown')).toBe(true);
  expect(result.categories.map((category) => category.role)).toContain('variables');
});

test('recolours existing blocks from the block type instead of the previous colour', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    // 刻意把 block 顏色設為另一個模組的色碼，舊的執行期色碼反查會把它改回同色。
    window.CodeBridgeBlocklyXml.textToWorkspace(
      '<xml><block type="initializes_setup"><next><block type="arduino_digital_write">' +
        '<value name="STATE"><shadow type="arduino_digital_high"></shadow></value>' +
        '</block></next></block></xml>',
      workspace
    );
    const target = workspace.getAllBlocks(false).find((block) => block.type === 'arduino_digital_write');
    target.setColour('#1d7fd8');
    const engineerBefore = target.getColour();
    const blockId = target.id;
    window.CodeBridgeTheme.setPreset('angel');
    return {
      engineerBefore,
      angelAfter: workspace.getBlockById(blockId)?.getColour(),
      expected: window.CodeBridgeBlockPalette.getColour('candy-light', 'digital')
    };
  });

  expect(result.engineerBefore).toBe('#1d7fd8');
  expect(result.angelAfter).toBe('#3fbf91');
  expect(result.angelAfter).toBe(result.expected);
});

test('resolves block colours from the semantic palette without legacy HUE messages', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('codebridgeExperiencePreset', 'engineer');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const engineer = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const read = (type) => {
      const block = workspace.newBlock(type);
      block.initSvg();
      const colour = block.getColour();
      block.dispose(false);
      return colour;
    };
    return {
      digitalBlock: read('arduino_digital_write'),
      digitalRole: window.CodeBridgeBlockPalette.getColour('technology-dark', 'digital'),
      logicBlock: read('logic_compare'),
      logicRole: window.CodeBridgeBlockPalette.getColour('technology-dark', 'logic'),
      // CodeBridge 專屬的 *_HUE key 應已從模組語系檔移除；
      // Blockly 官方 msg 自帶的 LOGIC_HUE／MATH_HUE 不在此範圍。
      legacyDigital: window.Blockly.Msg.ARDUINO_DIGITAL_IO_HUE ?? null,
      legacyLogicCompare: window.Blockly.Msg.LOGIC_COMPARE_HUE ?? null
    };
  });

  expect(engineer.digitalBlock).toBe(engineer.digitalRole);
  expect(engineer.logicBlock).toBe(engineer.logicRole);
  expect(engineer.legacyDigital).toBeNull();
  expect(engineer.legacyLogicCompare).toBeNull();

  await page.evaluate(() => window.CodeBridgeTheme.setPreset('angel'));
  const angel = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.newBlock('arduino_digital_write');
    block.initSvg();
    const colour = block.getColour();
    block.dispose(false);
    return {
      digitalBlock: colour,
      digitalRole: window.CodeBridgeBlockPalette.getColour('candy-light', 'digital')
    };
  });

  expect(angel.digitalBlock).toBe(angel.digitalRole);
});

test('lets a third-party module join the palette contract by role', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeTheme && window.Blockly?.getMainWorkspace?.());

  const result = await page.evaluate(() => {
    const palette = window.CodeBridgeBlockPalette;
    palette.registerModule({
      id: 'sensors',
      role: 'sensor',
      typePrefix: 'sensor_',
      colours: { 'technology-dark': '#334155', 'candy-light': '#94a3b8' }
    });
    return {
      role: palette.getRoleForBlockType('sensor_read_temperature'),
      engineer: palette.getColour('technology-dark', 'sensor'),
      angel: palette.getColour('candy-light', 'sensor')
    };
  });

  expect(result.role).toBe('sensor');
  expect(result.engineer).toBe('#334155');
  expect(result.angel).toBe('#94a3b8');
});
