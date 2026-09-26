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
      storedBlockStyle: localStorage.getItem('codebridgeBlockStyle'),
      message: window.Blockly.Msg.VARIABLES_DECLARE_GLOBAL_MESSAGE,
      background: getComputedStyle(document.body).backgroundColor,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--cb-primary').trim()
    };
  });

  expect(result.preset).toBe('angel');
  expect(result.visualTheme).toBe('candy-light');
  expect(result.storedPreset).toBe('angel');
  expect(result.storedBlockStyle).toBe('angel');
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

test('migrates the legacy codebridgeTheme value to the experience preset', async ({ page }) => {
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
    checked: document.querySelector('#themeToggle').checked
  }));

  expect(result).toEqual({
    preset: 'angel',
    storedPreset: 'angel',
    storedStyle: 'angel',
    checked: true
  });
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
    storedStyle: localStorage.getItem('codebridgeBlockStyle'),
    checked: document.querySelector('#themeToggle').checked
  }));

  expect(result.preset).toBe('engineer');
  expect(result.storedPreset).toBe('engineer');
  expect(result.storedStyle).toBe('engineer');
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
    const dropdown = document.querySelector('.dropdown-content');
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
