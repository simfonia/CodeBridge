import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = join(testDirectory, '..', 'fixtures', 'blockly-v12');

const cases = [
  {
    name: 'setup-loop.xml',
    expectedTypes: [
      'arduino_delay',
      'arduino_pin_mode',
      'arduino_pin_shadow',
      'initializes_loop',
      'initializes_setup',
      'math_number'
    ],
    expectedComment: '設定輸出腳位',
    expectedCode: `// Includes


// Global variables


void setup() {
  pinMode(13, OUTPUT);

}

void loop() {
  delay(100);

}
`
  },
  {
    name: 'controls-if.xml',
    expectedTypes: [
      'arduino_delay',
      'arduino_digital_write',
      'arduino_digital_write',
      'arduino_pin_shadow',
      'arduino_pin_shadow',
      'controls_if',
      'initializes_setup',
      'logic_boolean',
      'logic_compare',
      'math_number',
      'math_number',
      'math_number'
    ],
    expectedComment: null,
    expectedCode: `// Includes


// Global variables


void setup() {
  if (1 == 1) {
    digitalWrite(2, HIGH);
  } else if (true) {
    digitalWrite(3, LOW);
  } else {
    delay(5);
  }

}
`
  },
  {
    name: 'controls-for.xml',
    expectedTypes: [
      'arduino_serial_print',
      'controls_for',
      'initializes_loop',
      'math_arithmetic',
      'math_number',
      'math_number',
      'math_number',
      'math_number',
      'math_number'
    ],
    expectedComment: null,
    expectedCode: `// Includes


// Global variables


void loop() {
  for (int i = 0; i <= 3; i++) {
    Serial.print((10 + 1));
  }

}
`
  },
  {
    name: 'text.xml',
    expectedTypes: [
      'arduino_serial_print',
      'initializes_setup',
      'math_number',
      'text',
      'text_join'
    ],
    expectedComment: null,
    expectedCode: `// Includes


// Global variables


void setup() {
  Serial.print((String("Count: ") + String(7)));

}
`
  },
  {
    name: 'workspace-comment.xml',
    expectedTypes: [],
    expectedComment: null,
    expectedWorkspaceComment: {
      text: '請先讀取感測器數值',
      x: 420,
      y: 60,
      width: 200,
      height: 80,
      isPinned: false
    },
    expectedCode: `// Includes


// Global variables
`
  }
];

function removeIdMarkers(code) {
  return code.replace(/ \/\/ __BLOCKLY_ID:[^\r\n]*/g, '');
}

for (const fixture of cases) {
  test(`loads v12 ${fixture.name} and preserves generator output`, async ({ page }) => {
    const browserMessages = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        browserMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));

    await page.goto('/');
    await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

    const xml = await readFile(join(fixtureDirectory, fixture.name), 'utf8');
    const result = await page.evaluate((workspaceXml) => {
      const workspace = window.Blockly.getMainWorkspace();
      workspace.clear();
      window.CodeBridgeBlocklyXml.textToWorkspace(workspaceXml, workspace);
      workspace.updateAriaLabel();
      const blocks = workspace.getAllBlocks(false);
      return {
        types: blocks.map((block) => block.type).sort(),
        comments: blocks.flatMap((block) =>
          block.getCommentText ? [block.getCommentText()] : []
        ).filter(Boolean),
        workspaceComments: Array.from(
          window.Blockly.Xml.workspaceToDom(workspace).querySelectorAll('comment'),
          (comment) => ({
            text: comment.textContent,
            x: Number(comment.getAttribute('x')),
            y: Number(comment.getAttribute('y')),
            width: Number(comment.getAttribute('w')),
            height: Number(comment.getAttribute('h')),
            isPinned: comment.getAttribute('pinned') === 'true',
            parentTag: comment.parentElement?.tagName ?? ''
          })
        ).filter((comment) => comment.parentTag === 'xml').map((comment) => ({
          text: comment.text,
          x: comment.x,
          y: comment.y,
          width: comment.width,
          height: comment.height,
          isPinned: comment.isPinned
        })),
        code: window.Blockly.Arduino.workspaceToCode(workspace)
      };
    }, xml);

    expect(result.types).toEqual(fixture.expectedTypes);
    expect(result.comments).toEqual(
      fixture.expectedComment ? [fixture.expectedComment] : []
    );
    expect(result.workspaceComments).toEqual(
      fixture.expectedWorkspaceComment ? [fixture.expectedWorkspaceComment] : []
    );
    expect(removeIdMarkers(result.code)).toBe(fixture.expectedCode);
    expect(browserMessages).toEqual([]);
  });
}

test('preserves migrated controls_if when switching block style', async ({ page }) => {
  const browserMessages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await page.waitForFunction(() => window.Blockly?.getMainWorkspace?.());

  const xml = await readFile(join(fixtureDirectory, 'controls-if.xml'), 'utf8');
  const result = await page.evaluate((workspaceXml) => {
    const workspace = window.Blockly.getMainWorkspace();
    workspace.clear();
    window.CodeBridgeBlocklyXml.textToWorkspace(workspaceXml, workspace);
    window.setBlockStyle('angel');
    const controlsIf = workspace.getBlocksByType('controls_if', false)[0];
    return {
      inputNames: controlsIf?.inputList.map((input) => input.name) ?? [],
      ariaLabel: document
        .querySelector('.blocklyWorkspaceSelectionRing[role="figure"]')
        ?.getAttribute('aria-label') ?? ''
    };
  }, xml);

  expect(result.inputNames).toEqual(['IF0', 'DO0', 'IF1', 'DO1', 'ELSE']);
  expect(result.ariaLabel).toBe('1 stack of blocks');
  expect(browserMessages).toEqual([]);
});
