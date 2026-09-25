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
        'text_join'
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
  expect(contract.generatorCount).toBe(43);
  expect(contract.defaultBlockTypes).toEqual(['initializes_loop', 'initializes_setup']);
  expect(contract.ariaRole).toBe('figure');
  expect(contract.ariaLabel).toBe('1 stack of blocks');
  expect(contract.loadedMedia).toEqual([]);
  expect(mediaRequests).toEqual([]);
  expect(blocklyResponses.length).toBeGreaterThanOrEqual(9);
  expect(blocklyResponses.every((response) => response.status === 200)).toBe(true);
  expect(browserMessages).toEqual([]);
});
