import { expect, test } from '@playwright/test';

const browserMessages = [];
const blocklyResponses = [];
const mediaRequests = [];

test.beforeEach(async ({ page }) => {
  browserMessages.length = 0;
  blocklyResponses.length = 0;
  mediaRequests.length = 0;
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    browserMessages.push(`pageerror: ${error.message}`);
  });
  page.on('request', (request) => {
    if (/\.(?:mp3|wav|ogg)(?:\?|$)/i.test(request.url())) {
      mediaRequests.push(request.url());
    }
  });
  page.on('response', (response) => {
    if (response.url().includes('/blockly/')) {
      blocklyResponses.push({ url: response.url(), status: response.status() });
    }
  });
});

test('loads the Blockly 13.3.0 runtime contract', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  await expect.poll(async () => {
    return page.locator('.blocklyWorkspaceSelectionRing[role="figure"]').getAttribute('aria-label');
  }).toBe('1 stack of blocks');

  const contract = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const focusTarget = document.querySelector('.blocklyWorkspaceSelectionRing[role="figure"]');
    return {
      version: window.Blockly.VERSION,
      renderer: workspace.options.renderer,
      hasSounds: workspace.options.hasSounds,
      blockTypeCount: Object.keys(window.Blockly.Blocks).length,
      requiredBlockTypes: [
        'arduino_pin_shadow',
        'controls_if',
        'initializes_loop',
        'initializes_setup',
        'text_join',
        'variables_declare_global',
        'variables_declare_local',
        'variables_get',
        'variables_set',
        'array_declare_global',
        'array_declare_local',
        'array_get',
        'array_set',
        'array_length',
        'custom_functions_defnoreturn',
        'custom_functions_defreturn',
        'custom_functions_return',
        'custom_functions_callnoreturn_manual',
        'custom_functions_callreturn_manual',
        'custom_functions_mutatorcontainer',
        'custom_functions_mutatorarg'
      ].every((type) => Boolean(window.Blockly.Blocks[type])),
      generatorCount: Object.keys(window.Blockly.Arduino.forBlock).length,
      defaultBlockTypes: workspace.getAllBlocks(false).map((block) => block.type).sort(),
      ariaRole: focusTarget?.getAttribute('role') ?? '',
      ariaLabel: focusTarget?.getAttribute('aria-label') ?? '',
      loadedMedia: performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => /\.(?:mp3|wav|ogg)(?:\?|$)/i.test(url))
    };
  });

  expect(contract.version).toBe('13.3.0');
  expect(contract.renderer).toBe('thrasos');
  expect(contract.hasSounds).toBe(false);
  expect(contract.blockTypeCount).toBeGreaterThanOrEqual(45);
  expect(contract.requiredBlockTypes).toBe(true);
  expect(contract.generatorCount).toBe(57);
  expect(contract.defaultBlockTypes).toEqual(['initializes_loop', 'initializes_setup']);
  expect(contract.ariaRole).toBe('figure');
  expect(contract.ariaLabel).toBe('1 stack of blocks');
  expect(contract.loadedMedia).toEqual([]);
  expect(mediaRequests).toEqual([]);
  expect(blocklyResponses.length).toBeGreaterThanOrEqual(9);
  expect(blocklyResponses.every((response) => response.status === 200)).toBe(true);
  expect(browserMessages).toEqual([]);
});

test('registers Variables messages for both block styles', async ({ page }) => {
  const browserMessages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  const messages = await page.evaluate(() => {
    window.setBlockStyle('angel');
    const angel = {
      global: window.Blockly.Msg.VARIABLES_DECLARE_GLOBAL_MESSAGE,
      local: window.Blockly.Msg.VARIABLES_DECLARE_LOCAL_MESSAGE,
      set: window.Blockly.Msg.VARIABLES_SET_MESSAGE
    };
    window.setBlockStyle('engineer');
    const engineer = {
      global: window.Blockly.Msg.VARIABLES_DECLARE_GLOBAL_MESSAGE,
      local: window.Blockly.Msg.VARIABLES_DECLARE_LOCAL_MESSAGE,
      set: window.Blockly.Msg.VARIABLES_SET_MESSAGE
    };
    return { angel, engineer };
  });

  expect(messages.angel.global).toContain('create global variable');
  expect(messages.angel.local).toContain('create local variable');
  expect(messages.angel.set).toContain('set ');
  expect(messages.engineer).toEqual({
    global: 'Global %1 %2 = %3',
    local: 'Local %1 %2 = %3',
    set: '%1 = %2'
  });
  expect(browserMessages).toEqual([]);
});

test('registers Array and Functions messages for both block styles', async ({ page }) => {
  const messages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  const blockMessages = await page.evaluate(() => {
    const read = () => ({
      arrayGlobal: window.Blockly.Msg.ARRAY_DECLARE_GLOBAL_TITLE,
      arrayOpen: window.Blockly.Msg.ARRAY_GET_BRACKET_OPEN,
      voidDefinition: window.Blockly.Msg.CUSTOM_FUNCTIONS_DEFNORETURN_MESSAGE,
      returnDefinition: window.Blockly.Msg.CUSTOM_FUNCTIONS_DEFRETURN_MESSAGE,
      call: window.Blockly.Msg.CUSTOM_FUNCTIONS_CALLNORETURN_MESSAGE,
      returnValue: window.Blockly.Msg.CUSTOM_FUNCTIONS_RETURN_MESSAGE
    });
    window.setBlockStyle('angel');
    const angel = read();
    window.setBlockStyle('engineer');
    return { angel, engineer: read() };
  });

  expect(blockMessages.angel.arrayGlobal).toBe('Create Global Array');
  expect(blockMessages.angel.arrayOpen).toBe('item #');
  expect(blockMessages.angel.voidDefinition).toContain('do task');
  expect(blockMessages.angel.returnValue).toContain('report back');
  expect(blockMessages.engineer).toEqual({
    arrayGlobal: 'Global Array',
    arrayOpen: '[',
    voidDefinition: 'void %1 (%2) {',
    returnDefinition: '%1 %2 (%3) {',
    call: '%1()',
    returnValue: 'return %1'
  });
  expect(messages).toEqual([]);
});

test('exposes Array and Functions toolbox blocks and instantiates every definition', async ({ page }) => {
  const messages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  const result = await page.evaluate(() => {
    const workspace = window.Blockly.getMainWorkspace();
    const publicTypes = [
      'array_declare_global',
      'array_declare_local',
      'array_get',
      'array_set',
      'array_length',
      'custom_functions_defnoreturn',
      'custom_functions_defreturn',
      'custom_functions_return',
      'custom_functions_callnoreturn_manual',
      'custom_functions_callreturn_manual'
    ];
    const definitionTypes = publicTypes.concat([
      'custom_functions_mutatorcontainer',
      'custom_functions_mutatorarg'
    ]);
    const instantiated = definitionTypes.map((type) => {
      const block = workspace.newBlock(type);
      block.initSvg();
      const colour = block.getColour();
      block.dispose(false);
      return { type, colour };
    });
    const toolboxTypes = Array.from(
      document.getElementById('toolbox-xml').querySelectorAll('block'),
      (block) => block.getAttribute('type')
    );
    return {
      instantiated,
      missingToolboxTypes: publicTypes.filter((type) => !toolboxTypes.includes(type)),
      helperTypesInToolbox: toolboxTypes.filter((type) =>
        type.startsWith('custom_functions_mutator')
      )
    };
  });

  expect(result.instantiated).toHaveLength(12);
  expect(result.instantiated.every(({ colour }) => Boolean(colour))).toBe(true);
  expect(result.missingToolboxTypes).toEqual([]);
  expect(result.helperTypesInToolbox).toEqual([]);
  expect(messages).toEqual([]);
});

test('searches toolbox blocks from the embedded search box', async ({ page }) => {
  const messages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());
  const searchBox = page.locator('#block-search');
  await expect(searchBox).toBeVisible();
  await expect(page.locator('#block-search-container')).toHaveJSProperty(
    'previousElementSibling',
    null
  );

  await searchBox.fill('array length');
  await expect.poll(() => page.evaluate(() =>
    window.CodeBridgeBlockSearch.search('array length').map((item) => item.type)
  )).toContain('array_length');
  await expect(page.locator('.blocklyToolboxFlyout')).toBeVisible();
  await expect(page.locator('#block-search-clear')).toBeVisible();

  const helperResults = await page.evaluate(() =>
    window.CodeBridgeBlockSearch.search('custom_functions_mutatorcontainer')
  );
  expect(helperResults).toEqual([]);

  await searchBox.fill('no-such-codebridge-block-12345');
  await expect(page.locator('#block-search-status')).toBeVisible();
  await expect(page.locator('.blocklyToolboxFlyout')).toBeHidden();
  await searchBox.press('Escape');
  await expect(searchBox).toHaveValue('');
  await expect(page.locator('#block-search-clear')).toBeHidden();
  await expect(page.locator('#block-search-status')).toBeHidden();
  expect(messages).toEqual([]);
});

test('refreshes toolbox search after switching block styles', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.CodeBridgeBlockSearch?.initialized);
  const searchBox = page.locator('#block-search');

  await page.evaluate(() => window.setBlockStyle('engineer'));
  await searchBox.fill('Global Array');
  await expect.poll(() => page.evaluate(() =>
    window.CodeBridgeBlockSearch.search('Global Array').map((item) => item.type)
  )).toContain('array_declare_global');

  await page.evaluate(() => window.setBlockStyle('angel'));
  await searchBox.fill('Create Global Array');
  await expect.poll(() => page.evaluate(() =>
    window.CodeBridgeBlockSearch.search('Create Global Array').map((item) => item.type)
  )).toContain('array_declare_global');
  await expect(page.locator('.blocklyToolboxFlyout')).toBeVisible();
});
