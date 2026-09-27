import { expect, test } from '@playwright/test';
import { installTauriMock, setUiLocale } from '../support/tauri-mock.js';

/**
 * 工作區滾輪行為的端對端驗證。
 *
 * Blockly 的 `onMouseWheel` 判斷是
 *   `zoomWheel && (ctrlKey || metaKey || !moveWheel)` → zoom，否則 scroll。
 * 只開 `zoom.wheel` 時 `moveWheel` 為 undefined，`!moveWheel` 恆為真，
 * 會讓**任何**滾輪都縮放。這裡以實際滾動事件驗證三種情境：
 * 純滾輪 = 捲動、Ctrl+滾輪 = 縮放、Scale 在兩者間正確切換。
 */

async function readWorkspaceState(page) {
  return page.evaluate(() => {
    const workspace = Blockly.getMainWorkspace();
    return { scrollY: workspace.scrollY, scale: workspace.scale };
  });
}

/**
 * 在工作區中央產生滾輪事件；`ctrlKey` 用來區分捲動與縮放。
 *
 * 事件必須派發到 Blockly 的 `svgGroup_`：`onMouseWheel` 是在該元素上註冊
 * listener（`k(this.svgGroup_, "wheel", this, this.onMouseWheel, ...)`），
 * 派發到外層 `#blocklyDiv` 只會往下冒泡，不會往上走到 listener。
 *
 * `svgGroup_` 對應 `svg.blocklySvg > g.blocklyWorkspace`。
 * 派發到外層 `#blocklyDiv` 只會往下冒泡，不會往上走到 listener。
 */
async function wheelAtCenter(page, deltaY, ctrlKey = false) {
  const box = await page.locator('#blocklyDiv').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(({ y, ctrl }) => {
    // `svg.blocklySvg` 的子節點順序為 `<defs>` + `g.blocklyWorkspace`，
    // 因此 firstChild 會取到 `<defs>`（事件不會冒泡到 g）。
    // 必須明確挑出 `g.blocklyWorkspace` 才是 onMouseWheel 的註冊目標。
    const svgGroup = document.querySelector('svg.blocklySvg > g.blocklyWorkspace');
    if (!svgGroup) throw new Error('找不到 g.blocklyWorkspace，無法派發 wheel');
    svgGroup.dispatchEvent(new WheelEvent('wheel', {
      deltaY: y,
      deltaX: 0,
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
      ctrlKey: ctrl,
      bubbles: true,
      cancelable: true
    }));
  }, { y: deltaY, ctrl: ctrlKey });
  await page.waitForTimeout(120);
}

test.describe('工作區滾輪', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    // 知道啟動時有草存還原弍話框；這些測試不調用該框，先清掉保謍一致性
    await page.addInitScript(() => localStorage.removeItem('codebridgeProjectDraft'));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(300);
    // 預設只有 setup + loop 兩顆積木，工作區高度不足以捲動，
    // scrollY 會被夾在 0 而讓測試失去鑑別力。
    // 因此額外堆積木到遠處，確保真的有可捲動範圍。
    // 刻意不呼叫 dispose：CodeBridge 的程式碼面板在 block move 事件中
    // 會回頭查詢已 disposed 的 block 而拋錯。
    await page.evaluate(() => {
      const workspace = Blockly.getMainWorkspace();
      for (let row = 0; row < 30; row += 1) {
        const block = workspace.newBlock('arduino_delay');
        block.initSvg();
        block.render();
        block.moveBy(60, 1200 + row * 60);
      }
      workspace.scroll(0, 0);
    });
    await page.waitForTimeout(200);
  });

  test('注入選項同時開啟 move.wheel 與 zoom.wheel', async ({ page }) => {
    const options = await page.evaluate(() => {
      const injected = Blockly.getMainWorkspace().options;
      return {
        moveWheel: injected.moveOptions.wheel,
        zoomWheel: injected.zoomOptions.wheel
      };
    });

    expect(options.moveWheel).toBe(true);
    expect(options.zoomWheel).toBe(true);
  });

  test('純滾輪改變 scrollY，不改變 scale', async ({ page }) => {
    const before = await readWorkspaceState(page);
    await wheelAtCenter(page, 240);
    const after = await readWorkspaceState(page);

    expect(after.scrollY).not.toBe(before.scrollY);
    expect(after.scale).toBe(before.scale);
    // 純滾輪不得觸發縮放
    expect(after.scale).toBeCloseTo(1, 5);
  });

  test('Ctrl + 滾輪縮放工作區', async ({ page }) => {
    // Blockly 在注入後會延遲呼叫 scrollToStart()，基準值必須等它跑完再取，
    // 否則會把那次捲動誤算成這次操作的結果。
    await page.waitForTimeout(300);
    const before = await readWorkspaceState(page);
    await wheelAtCenter(page, 240, true);
    const after = await readWorkspaceState(page);

    // 縮放契約：Ctrl+滾輪必須改變 scale。
    // 注意 scrollY 也會跟著動 —— Blockly 的 zoom() 內部會呼叫 scroll()
    // 讓游標下的積木維持在螢幕同位置，這是刻意行為，不應在此處禁止。
    expect(after.scale).not.toBe(before.scale);
    // 縮放方向正確：deltaY 為正（向下滾）＝ 縮小
    expect(after.scale).toBeLessThan(before.scale);
  });

  test('反向滾輪可回到原位（scrollY 對稱）', async ({ page }) => {
    const start = await readWorkspaceState(page);
    await wheelAtCenter(page, 200);
    await wheelAtCenter(page, -200);
    const end = await readWorkspaceState(page);

    expect(Math.round(end.scrollY)).toBe(Math.round(start.scrollY));
  });
});

test.describe('工作區邊界框', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    // 知道啟動時有草存還原弍話框；這些測試不調用該框，先清掉保謍一致性
    await page.addInitScript(() => localStorage.removeItem('codebridgeProjectDraft'));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(400);
  });

  test('不繪製工作區外圍的細線框', async ({ page }) => {
    // 兩種元素都會在畫面上畫出一圈線，但都不是可操作的邊界：
    // 1. `.blocklyMainBackground`：Blockly 預設的工作區可見範圍輪廓（灰色）。
    // 2. `.blocklyWorkspaceSelectionRing`：鍵盤／螢幕閱讀器的焦點框，
    //    CodeBridge 原本把它設成 `--cb-focus`（Engineer 為青色 #35c7d4），
    //    於是常駐可見，最容易被誤讀成「積木不該超過這條線」。
    const strokes = await page.evaluate(() => {
      const read = (selector) => {
        const nodes = Array.from(document.querySelectorAll(selector));
        return nodes.map((node) => {
          const box = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          // 只看實際佔據畫面的節點，忽略 0×0 的隱性複本
          const visible = box.width > 0 && box.height > 0;
          return { visible, stroke: style.stroke };
        });
      };
      return {
        background: read('.blocklyMainBackground'),
        selectionRing: read('.blocklyWorkspaceSelectionRing')
      };
    });

    // 可見且仍有筆畫的節點才是問題（`stroke: none` 代表已正確關閉）
    const stillStroked = [...strokes.background, ...strokes.selectionRing]
      .filter((item) => item.visible && item.stroke !== 'none')
      .map((item) => item.stroke);
    expect(stillStroked).toEqual([]);
  });

  test('工作區仍以 SVG 邊界裁切，積木不會畫到面板外', async ({ page }) => {
    // 拿掉視覺框線不等於放寬裁切：overflow 必須維持 hidden，
    // 否則縮放時積木會溢出到工具列或終端機面板上。
    const overflow = await page.evaluate(
      () => getComputedStyle(document.querySelector('svg.blocklySvg')).overflow
    );

    expect(overflow).toBe('hidden');
  });

  test('縮放與捲動後 SVG 邊界仍與面板對齊', async ({ page }) => {
    const geometry = await page.evaluate(async () => {
      const workspace = Blockly.getMainWorkspace();
      workspace.scroll(0, 200);
      workspace.zoom(-1, 200, 200, 1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const svg = document.querySelector('svg.blocklySvg').getBoundingClientRect();
      const host = document.getElementById('blocklyDiv').getBoundingClientRect();
      return {
        svgWidth: Math.round(svg.width),
        hostWidth: Math.round(host.width),
        svgHeight: Math.round(svg.height),
        hostHeight: Math.round(host.height)
      };
    });

    // SVG 邊界就是可見的工作區，兩者必須一致
    expect(geometry.svgWidth).toBe(geometry.hostWidth);
    expect(geometry.svgHeight).toBe(geometry.hostHeight);
  });

  test('小視窗下 SVG 不會溢出面板（積木不會畫到工具箱上）', async ({ page }) => {
    // 對齊實際桌面視窗尺寸；SVG 若大於 #blocklyDiv 就會溢出到工具箱
    await page.setViewportSize({ width: 830, height: 641 });
    await page.waitForTimeout(400);

    const geometry = await page.evaluate(() => {
      const svg = document.querySelector('svg.blocklySvg').getBoundingClientRect();
      const host = document.getElementById('blocklyDiv').getBoundingClientRect();
      const area = document.getElementById('blocklyArea').getBoundingClientRect();
      return {
        svg: [Math.round(svg.x), Math.round(svg.y), Math.round(svg.width), Math.round(svg.height)],
        host: [Math.round(host.x), Math.round(host.y), Math.round(host.width), Math.round(host.height)],
        areaWidth: Math.round(area.width)
      };
    });

    // 尺寸不得超出宿主
    expect(geometry.svg[2]).toBeLessThanOrEqual(geometry.host[2]);
    expect(geometry.svg[3]).toBeLessThanOrEqual(geometry.host[3]);
    // 也不得超出 blocklyArea（否則會蓋住右側程式碼面板）
    expect(geometry.svg[2]).toBeLessThanOrEqual(geometry.areaWidth);

});

test.describe('縮放至符合內容', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    // 知道啟動時有草存還原弍話框；這些測試不調用該框，先清掉保謍一致性
    await page.addInitScript(() => localStorage.removeItem('codebridgeProjectDraft'));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(400);
  });

  test('按鈕存在且已啟用，帶有翻譯 tooltip', async ({ page }) => {
    const button = page.locator('#btn-zoom-fit');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute('title', /符合內容|fit/i);
  });

  test('有積木時把全部積木縮放進可視範圍', async ({ page }) => {
    // 先堆一條長鏈，讓預設 100% 下必然超出畫面
    await page.evaluate(() => {
      const workspace = Blockly.getMainWorkspace();
      for (let row = 0; row < 12; row += 1) {
        const block = workspace.newBlock('arduino_delay');
        block.initSvg();
        block.render();
        block.moveBy(60, 900 + row * 70);
      }
    });
    await page.waitForTimeout(300);

    const result = await page.evaluate(async () => {
      const workspace = Blockly.getMainWorkspace();
      workspace.setScale(1);
      workspace.scroll(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const before = workspace.scale;
      document.getElementById('btn-zoom-fit').click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { before, after: workspace.scale };
    });

    expect(result.after).not.toBe(result.before);
    // 必須落在可縮放範圍內
    expect(result.after).toBeGreaterThanOrEqual(0.3);
    expect(result.after).toBeLessThanOrEqual(3);
  });

  test('積木縮放後完整落在工作區可視範圍內', async ({ page }) => {
    await page.evaluate(() => {
      const workspace = Blockly.getMainWorkspace();
      for (let row = 0; row < 10; row += 1) {
        const block = workspace.newBlock('arduino_delay');
        block.initSvg();
        block.render();
        block.moveBy(60, 800 + row * 70);
      }
    });
    await page.waitForTimeout(300);
    await page.locator('#btn-zoom-fit').click();
    await page.waitForTimeout(400);

    const fits = await page.evaluate(() => {
      const workspace = Blockly.getMainWorkspace();
      const host = document.getElementById('blocklyDiv').getBoundingClientRect();
      const nodes = Array.from(document.querySelectorAll('.blocklyBlockCanvas .blocklyDraggable'));
      if (nodes.length === 0) return { ok: true, reason: 'no-blocks' };
      return {
        ok: nodes.every((node) => {
          const box = node.getBoundingClientRect();
          return box.left >= host.left - 1 && box.right <= host.right + 1
            && box.top >= host.top - 1 && box.bottom <= host.bottom + 1;
        }),
        total: nodes.length
      };
    });

    // Blockly 的 zoomToFit 會保留 40px 留白，理論上應全部在框內
    expect(fits.ok).toBe(true);
  });

  test('沒有積木時回到 100% 而不是縮到極小值', async ({ page }) => {
    // 用官方的 clear() 清空，而不是逐一 dispose()。
    // 逐一 dispose 會觸發 block move 事件，而 CodeBridge 的程式碼面板
    // 會在該事件中回頭查詢已被銷毀的 block 而拋錯。
    await page.evaluate(async () => {
      const workspace = Blockly.getMainWorkspace();
      workspace.clear();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    await page.waitForTimeout(300);

    const scale = await page.evaluate(async () => {
      const workspace = Blockly.getMainWorkspace();
      workspace.setScale(2.5);
      await new Promise((resolve) => setTimeout(resolve, 150));
      document.getElementById('btn-zoom-fit').click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return workspace.scale;
    });

    expect(scale).toBe(1);
  });
});
});

test.describe('終端機面板外觀與調整', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    // 知道啟動時有草存還原弍話框；這些測試不調用該框，先清掉保謍一致性
    await page.addInitScript(() => localStorage.removeItem('codebridgeProjectDraft'));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(500);
  });

  test('三角收合鈕與程式預覽面板的切換鈕配色一致', async ({ page }) => {
    const colours = await page.evaluate(() => {
      const read = (id) => {
        const style = getComputedStyle(document.getElementById(id));
        return { background: style.backgroundColor, color: style.color, border: style.borderTopColor };
      };
      return { code: read('code-toggle'), terminal: read('terminal-toggle') };
    });
    expect(colours.terminal).toEqual(colours.code);
  });

  test('兩項切換鈕都有 hover 與 active 回饋', async ({ page }) => {
    const rules = await page.evaluate(() => Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try { return Array.from(sheet.cssRules).map((rule) => rule.cssText); } catch (error) { return []; }
      })
      .filter((text) => /#(code|terminal)-toggle(:hover|:active)?\b/.test(text)));
    const text = rules.join('\n');
    ['#code-toggle:hover', '#terminal-toggle:hover', '#code-toggle:active', '#terminal-toggle:active']
      .forEach((selector) => expect(text).toContain(selector));
  });

  test('調整棒在收合時也存在且可見（用來展開面板）', async ({ page }) => {
    await expect(page.locator('#terminal-resizer')).toBeVisible();
    const state = await page.evaluate(() => ({
      collapsed: document.getElementById('terminalArea').classList.contains('collapsed'),
      height: document.getElementById('terminalArea').offsetHeight
    }));
    expect(state.collapsed).toBe(true);
    // 收合時 CSS height 為 0，但 #terminalArea 的 border-top 仍佔 1px，
    // 因此量測值是 1 而非 0。
    expect(state.height).toBeLessThanOrEqual(1);
  });

  test('往上拖奧可調高終端機，且結束後清除拖奧狀態', async ({ page }) => {
    await page.locator('#terminal-toggle').click();
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
    const box = await page.locator('#terminal-resizer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 100, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      height: document.getElementById('terminalArea').offsetHeight,
      bodyClass: document.body.classList.contains('resizing-terminal'),
      dragClass: document.getElementById('terminal-resizer').classList.contains('is-dragging')
    }));
    expect(after.height).toBeGreaterThan(before);
    expect(after.bodyClass).toBe(false);
    expect(after.dragClass).toBe(false);
  });

  test('不會低於最小高度，也不會把工作區完全接掉', async ({ page }) => {
    await page.locator('#terminal-toggle').click();
    await page.waitForTimeout(300);
    const box = await page.locator('#terminal-resizer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 600, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const shrunk = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
    expect(shrunk).toBeGreaterThanOrEqual(90);

    const box2 = await page.locator('#terminal-resizer').boundingBox();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width / 2, box2.y - 900, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const grown = await page.evaluate(() => ({
      height: document.getElementById('terminalArea').offsetHeight,
      blockly: document.getElementById('blocklyDiv').offsetHeight
    }));
    expect(grown.blockly).toBeGreaterThan(100);
  });

  test('點收合鈕不會誤觸發拖奧調整', async ({ page }) => {
    await page.locator('#terminal-toggle').click();
    await page.waitForTimeout(300);
    const opened = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
    const box = await page.locator('#terminal-toggle').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 150, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      height: document.getElementById('terminalArea').offsetHeight,
      collapsed: document.getElementById('terminalArea').classList.contains('collapsed')
    }));
    expect(state.height).toBe(opened);
    expect(state.collapsed).toBe(false);
  });
});

test.describe('終端機高度與 fit 控制項', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page);
    await setUiLocale(page, 'zh-hant');
    // 知道啟動時有草存還原弍話框；這些測試不調用該框，先清掉保謍一致性
    await page.addInitScript(() => localStorage.removeItem('codebridgeProjectDraft'));
    await page.goto('/');
    await page.waitForFunction(() => Boolean(Blockly && Blockly.getMainWorkspace()));
    await page.waitForTimeout(500);
  });

  test('拖奧调高後仍可以收合與展開', async ({ page }) => {
    await page.locator('#terminal-toggle').click();
    await page.waitForTimeout(300);
    const box = await page.locator('#terminal-resizer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const grown = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
    expect(grown).toBeGreaterThan(200);

    // 這後收合鈕必須真的能收合
    await page.locator('#terminal-toggle').click();
    await page.waitForTimeout(400);
    const collapsed = await page.evaluate(() => ({
      collapsed: document.getElementById('terminalArea').classList.contains('collapsed'),
      height: document.getElementById('terminalArea').offsetHeight
    }));
    expect(collapsed.collapsed).toBe(true);
    expect(collapsed.height).toBeLessThanOrEqual(1);

    // 再展開時應回復上次的高度
    await page.locator('#terminal-toggle').click();
    await page.waitForTimeout(400);
    const reopened = await page.evaluate(() => document.getElementById('terminalArea').offsetHeight);
    expect(reopened).toBe(grown);
  });

  test('fit 按鈕位於工作區右上角', async ({ page }) => {
    const placement = await page.evaluate(() => {
      const fit = document.getElementById('btn-zoom-fit').getBoundingClientRect();
      const host = document.getElementById('blocklyDiv').getBoundingClientRect();
      return {
        fitRight: Math.round(fit.right),
        fitTop: Math.round(fit.top),
        hostRight: Math.round(host.right),
        hostTop: Math.round(host.top),
        marginRight: Math.round(host.right - fit.right),
        marginTop: Math.round(fit.top - host.top)
      };
    });
    // 距左上角約 20px
    expect(placement.marginRight).toBeGreaterThanOrEqual(15);
    expect(placement.marginRight).toBeLessThanOrEqual(25);
    expect(placement.marginTop).toBeGreaterThanOrEqual(15);
    expect(placement.marginTop).toBeLessThanOrEqual(25);
  });

  test('程式預覽面板收合時 fit 按鈕会跟著從工作區移動', async ({ page }) => {
    const before = await page.evaluate(() => {
      const host = document.getElementById('blocklyDiv').getBoundingClientRect();
      const fit = document.getElementById('btn-zoom-fit').getBoundingClientRect();
      return { gap: Math.round(host.right - fit.right), hostWidth: Math.round(host.width) };
    });

    // 收合程式預覽面板 -> 工作區变寬
    await page.locator('#code-toggle').click();
    await page.waitForTimeout(600);

    const after = await page.evaluate(() => {
      const host = document.getElementById('blocklyDiv').getBoundingClientRect();
      const fit = document.getElementById('btn-zoom-fit').getBoundingClientRect();
      return { gap: Math.round(host.right - fit.right), hostWidth: Math.round(host.width) };
    });

    // 工作區確實變寬了
    expect(after.hostWidth).toBeGreaterThan(before.hostWidth);
    // 且 fit 按鈕仍緊持在工作區右綴（沒被挤出觀種或卡在面板外）
    expect(after.gap).toBeGreaterThanOrEqual(15);
    expect(after.gap).toBeLessThanOrEqual(25);
  });
});
