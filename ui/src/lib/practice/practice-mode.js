/// CodeBridge 練習模式（程式碼撰寫導航員）
/// 職責：練習模式切換、程式碼比對引擎、提示系統
/// 位置：ui/src/lib/practice/practice-mode.js

// ============================================================
// 練習模式狀態
// ============================================================
var practiceMode = {
    isActive: false,           // 是否在練習模式
    standardCode: '',          // 原始標準答案
    normalizedStandard: [],    // 正規化後的標準答案（陣列）
    studentTextarea: null,     // 學生輸入的 textarea
    currentLineIndex: 0,       // 學生目前寫到第幾行
    results: [],               // 比對結果
    workspace: null            // Blockly 工作區參考
};

// ============================================================
// 正規化函式
// ============================================================

/**
 * 正規化程式碼（保留 C++ 特性）
 * @param {string} code - 原始程式碼
 * @returns {string[]} 正規化後的行陣列
 */
function normalizeCode(code) {
    if (!code || typeof code !== 'string') return [];
    
    // 1. 移除區塊註解 /* ... */（C++ 不允許巢狀註解）
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return code.split('\n')
        .map(function(line) {
            // 2. 移除單行註解（// 之後的全部忽略）
            line = line.replace(/\/\/.*$/g, '');
            // 3. 壓縮空白（保留 C++ 大小寫）
            line = line.replace(/\s+/g, ' ').trim();
            // 4. 寬容處理：token 空白標準化
            // 4a. 保護複合運算子（暫時取代為佔位符）
            line = line.replace(/==/g, ' __EQ__ ');
            line = line.replace(/!=/g, ' __NE__ ');
            line = line.replace(/<=/g, ' __LE__ ');
            line = line.replace(/>=/g, ' __GE__ ');
            line = line.replace(/&&/g, ' __AND__ ');
            line = line.replace(/\|\|/g, ' __OR__ ');
            line = line.replace(/\+\+/g, ' __INC__ ');
            line = line.replace(/--/g, ' __DEC__ ');
            line = line.replace(/\+=/g, ' __ADD_ASSIGN__ ');
            line = line.replace(/-=/g, ' __SUB_ASSIGN__ ');
            line = line.replace(/\*=/g, ' __MUL_ASSIGN__ ');
            line = line.replace(/\/=/g, ' __DIV_ASSIGN__ ');
            line = line.replace(/%=/g, ' __MOD_ASSIGN__ ');
            // 4b. 括號間距
            line = line.replace(/\(\s+/g, '(');
            line = line.replace(/\s+\)/g, ')');
            line = line.replace(/(\S)\{/g, '$1 {');
            // 4c. 逗號後統一空格
            line = line.replace(/,\s*/g, ', ');
            // 4d. 單一運算子前後統一空格
            line = line.replace(/\s*([=+\-*\/%<>!&|^])\s*/g, ' $1 ');
            // 4e. 關鍵字後加空格：if(, while(, for( 等
            line = line.replace(/\b(if|while|for|switch|catch)\s*\(/g, '$1 (');
            // 4f. 還原複合運算子
            line = line.replace(/__EQ__/g, '==');
            line = line.replace(/__NE__/g, '!=');
            line = line.replace(/__LE__/g, '<=');
            line = line.replace(/__GE__/g, '>=');
            line = line.replace(/__AND__/g, '&&');
            line = line.replace(/__OR__/g, '||');
            line = line.replace(/__INC__/g, '++');
            line = line.replace(/__DEC__/g, '--');
            line = line.replace(/__ADD_ASSIGN__/g, '+=');
            line = line.replace(/__SUB_ASSIGN__/g, '-=');
            line = line.replace(/__MUL_ASSIGN__/g, '*=');
            line = line.replace(/__DIV_ASSIGN__/g, '/=');
            line = line.replace(/__MOD_ASSIGN__/g, '%=');
            // 4g. 二次壓縮（避免產生多餘空白）
            line = line.replace(/\s+/g, ' ').trim();
            return line;
        })
        .filter(function(line) { return line.length > 0; }); // 移除空行
}

// ============================================================
// 分號檢查
// ============================================================

/**
 * 檢查是否只是遺漏分號
 * 保留標準行的分號作為比對基準，只檢查學生行是否少了結尾分號
 * @param {string} studentLine - 學生寫的行
 * @param {string} standardLine - 標準答案行
 * @returns {boolean}
 */
function isMissingSemicolon(studentLine, standardLine) {
    if (standardLine.endsWith(';') && !studentLine.endsWith(';')) {
        var withoutSemicolon = standardLine.slice(0, -1);
        return studentLine === withoutSemicolon;
    }
    return false;
}

// ============================================================
// 行序比對算法
// ============================================================

/**
 * 檢查學生的進度（基於行序的一對一比對）
 * @param {string} studentCode - 學生的程式碼（到目前行為止）
 * @returns {Array} 比對結果陣列
 */
function checkStudentProgress(studentCode) {
    var normalizedStudent = normalizeCode(studentCode);
    var results = [];
    
    for (var i = 0; i < normalizedStudent.length; i++) {
        var studentLine = normalizedStudent[i];
        var standardLine = practiceMode.normalizedStandard[i];
        
        if (!standardLine) {
            // 學生寫超過標準答案
            results.push({
                index: i,
                status: 'extra',
                line: studentLine,
                message: '多寫了這行'
            });
            continue;
        }
        
        // Level 1：完全匹配
        if (studentLine === standardLine) {
            results.push({
                index: i,
                status: 'correct',
                line: studentLine
            });
        } 
        // Level 2：檢查是否只是遺漏分號
        else if (isMissingSemicolon(studentLine, standardLine)) {
            results.push({
                index: i,
                status: 'warning',
                line: studentLine,
                expected: standardLine,
                message: '別忘了分號！'
            });
        }
        // Level 3：不匹配
        else {
            results.push({
                index: i,
                status: 'wrong',
                line: studentLine,
                expected: standardLine
            });
        }
    }
    
    return results;
}

// ============================================================
// 視覺反饋
// ============================================================

/**
 * 更新 textarea 的行樣式（背景色 + 圖示標記）
 */
function applyLineStyles() {
    var textarea = practiceMode.studentTextarea;
    if (!textarea) return;
    
    var value = textarea.value;
    var lines = value.split('\n');
    var results = practiceMode.results;
    
    // 清除所有行號樣式
    var lineNumbers = document.getElementById('practiceLineNumbers');
    if (lineNumbers) {
        lineNumbers.innerHTML = '';
    }
    
    // 重建行號並套用樣式
    var lineNumberHtml = '';
    var resultIndex = 0;
    
    for (var i = 0; i < lines.length; i++) {
        var lineNum = (i + 1).toString();
        var marker = '';
        var cssClass = '';
        var resultMessage = '';
        
        // 判斷此行是否參與比對（與 normalizeCode 邏輯一致）
        var rawLine = lines[i];
        var normalizedLine = rawLine.replace(/\/\/.*$/g, '').replace(/\s+/g, ' ').trim();
        var isSkippedLine = (normalizedLine.length === 0);
        
        // 找到對應的比對結果
        if (resultIndex < results.length) {
            var result = results[resultIndex];
            if (isSkippedLine) {
                // 註解行、空行：不參與比對，不標記
            } else {
                if (result.status === 'correct') {
                    marker = '✅';
                    cssClass = 'practice-line-correct';
                } else if (result.status === 'warning') {
                    marker = '⚠️';
                    cssClass = 'practice-line-warning';
                    resultMessage = result.message || '';
                } else if (result.status === 'wrong') {
                    marker = '❌';
                    cssClass = 'practice-line-wrong';
                } else if (result.status === 'extra') {
                    marker = '⚠️';
                    cssClass = 'practice-line-extra';
                }
                resultIndex++;
            }
        }
        
        // 建立帶 tooltip 的行號（warning 狀態顯示訊息）
        var titleAttr = '';
        if (cssClass === 'practice-line-warning' && resultMessage) {
            titleAttr = ' title="' + escapeHtml(resultMessage) + '"';
        }
        lineNumberHtml += '<div class="practice-line-num ' + cssClass + '"' + titleAttr + '>' + lineNum + ' ' + marker + '</div>';
    }
    
    if (lineNumbers) {
        lineNumbers.innerHTML = lineNumberHtml;
    }
}

// ============================================================
// 提示系統
// ============================================================

/**
 * 顯示提示（F2 快捷鍵）
 * @param {number} cursorPosition - 游標位置
 */
function showHint(cursorPosition) {
    var studentCode = practiceMode.studentTextarea.value.substring(0, cursorPosition);
    var results = checkStudentProgress(studentCode);
    
    // 計算已正確完成的行數（從結果陣列中找出第一個非 correct 的索引）
    var currentLineIndex = 0;
    for (var i = 0; i < results.length; i++) {
        if (results[i].status === 'correct') {
            currentLineIndex = i + 1;
        } else {
            break;
        }
    }
    
    // 取得接下來要寫的標準答案（3 行）
    var hintLines = practiceMode.normalizedStandard.slice(
        currentLineIndex, 
        currentLineIndex + 3
    );
    
    if (hintLines.length > 0) {
        showHintPopup(hintLines, currentLineIndex);
    } else {
        showCompletionMessage();
    }
}

/**
 * 顯示提示 Popup
 * @param {string[]} hintLines - 提示行陣列
 * @param {number} currentLineIndex - 目前行索引
 */
function showHintPopup(hintLines, currentLineIndex) {
    var hintPopup = document.getElementById('hintPopup');
    var hintContent = document.getElementById('hintContent');
    if (!hintPopup || !hintContent) return;
    
    var html = '';
    
    // 第一行：現在這一行
    if (hintLines.length > 0) {
        var currentLine = hintLines[0];
        html += '<div class="hint-context">現在這一行（第 ' + (currentLineIndex + 1) + ' 行）：</div>';
        html += '<div class="hint-current-line">' + escapeHtml(currentLine) + '</div>';
    }
    
    // 後續行
    if (hintLines.length > 1) {
        html += '<div class="hint-next-label">下一行：</div>';
        for (var i = 1; i < hintLines.length; i++) {
            html += '<div class="hint-line">' + escapeHtml(hintLines[i]) + '</div>';
        }
    }
    
    hintContent.innerHTML = html;
    hintPopup.style.display = 'block';
}

/**
 * 顯示完成訊息
 */
function showCompletionMessage() {
    var hintPopup = document.getElementById('hintPopup');
    var hintContent = document.getElementById('hintContent');
    if (!hintPopup || !hintContent) return;
    
    hintContent.innerHTML = '<div class="hint-complete">🎉 完成！你已經正確寫完所有程式碼！</div>';
    hintPopup.style.display = 'block';
}

/**
 * 隱藏提示 Popup
 */
function hideHintPopup() {
    var hintPopup = document.getElementById('hintPopup');
    if (hintPopup) {
        hintPopup.style.display = 'none';
    }
}

/**
 * HTML 跳脫（防止 XSS）
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ============================================================
// 作弊功能（查看完整答案）
// ============================================================

/**
 * 清除程式碼中的 Blockly ID 標記
 * @param {string} code - 原始程式碼
 * @returns {string} 清除標記後的程式碼
 */
function cleanBlocklyIds(code) {
    // 從 main.js 的 renderCode 複用 ID 標記常數
    var idMarker = '// __BLOCKLY_ID:';
    var idMarkerEnd = '__';
    return code.replace(new RegExp(' ' + idMarker + '[^\\s]+' + idMarkerEnd, 'g'), '');
}

/**
 * 切換作弊答案浮動視窗
 */
function toggleCheat() {
    var cheatOverlay = document.getElementById('cheatOverlay');
    var btnCheat = document.getElementById('btn-cheat');
    if (!cheatOverlay || !btnCheat) return;
    
    var isVisible = cheatOverlay.style.display !== 'none';
    if (isVisible) {
        cheatOverlay.style.display = 'none';
        btnCheat.classList.remove('active');
        // 恢復閉眼圖示 + tooltip
        var img = btnCheat.querySelector('img');
        if (img) img.src = 'src/icons/eye-closed-circle.png';
        btnCheat.setAttribute('title', getI18n('PRACTICE_CHEAT', '查看完整答案'));
    } else {
        // 填入原始標準答案（保留縮排，僅清除 Blockly ID 標記）
        var cheatContent = document.getElementById('cheatContent');
        if (cheatContent && practiceMode.standardCode) {
            var cleanCode = cleanBlocklyIds(practiceMode.standardCode);
            cheatContent.textContent = cleanCode;
        }
        cheatOverlay.style.display = 'flex';
        btnCheat.classList.add('active');
        // 切換開眼圖示 + tooltip
        var img = btnCheat.querySelector('img');
        if (img) img.src = 'src/icons/eye-circle.png';
        btnCheat.setAttribute('title', getI18n('PRACTICE_CHEAT_CLOSE', '關閉完整答案'));
    }
}

/**
 * 綁定作弊按鈕的 hover 圖示切換
 */
function bindCheatHover() {
    var btnCheat = document.getElementById('btn-cheat');
    if (!btnCheat) return;
    var img = btnCheat.querySelector('img');
    if (!img) return;
    
    btnCheat.addEventListener('mouseenter', function() {
        if (!btnCheat.classList.contains('active')) {
            img.src = 'src/icons/eye-circle.png';
        }
    });
    btnCheat.addEventListener('mouseleave', function() {
        if (!btnCheat.classList.contains('active')) {
            img.src = 'src/icons/eye-closed-circle.png';
        }
    });
}

/**
 * 初始化作弊浮動視窗的拖曳功能
 */
function initCheatDrag() {
    var cheatOverlay = document.getElementById('cheatOverlay');
    var cheatHeader = document.getElementById('cheatHeader');
    if (!cheatOverlay || !cheatHeader) return;
    
    var isDragging = false;
    var offsetX, offsetY;
    
    cheatHeader.addEventListener('mousedown', function(e) {
        // 不處理關閉按鈕的點擊
        if (e.target.classList.contains('cheat-close-btn')) return;
        isDragging = true;
        var rect = cheatOverlay.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        cheatOverlay.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        var newLeft = e.clientX - offsetX;
        var newTop = e.clientY - offsetY;
        
        // 邊界限制（不超出 viewport）
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - cheatOverlay.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - cheatOverlay.offsetHeight));
        
        cheatOverlay.style.left = newLeft + 'px';
        cheatOverlay.style.top = newTop + 'px';
        cheatOverlay.style.right = 'auto';
        cheatOverlay.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            cheatOverlay.style.cursor = '';
        }
    });
}

/**
 * 綁定作弊視窗關閉按鈕
 */
function bindCheatClose() {
    var btnClose = document.getElementById('btn-cheat-close');
    if (btnClose) {
        btnClose.addEventListener('click', function() {
            var cheatOverlay = document.getElementById('cheatOverlay');
            var btnCheat = document.getElementById('btn-cheat');
            if (cheatOverlay) cheatOverlay.style.display = 'none';
            if (btnCheat) {
                btnCheat.classList.remove('active');
                var img = btnCheat.querySelector('img');
                if (img) img.src = 'src/icons/eye-closed-circle.png';
                btnCheat.setAttribute('title', getI18n('PRACTICE_CHEAT', '查看完整答案'));
            }
        });
    }
}

// ============================================================
// 練習模式切換
// ============================================================

/**
 * 切換練習模式
 */
function togglePracticeMode() {
    if (practiceMode.isActive) {
        exitPracticeMode();
    } else {
        enterPracticeMode();
    }
}

/**
 * 進入練習模式
 */
function enterPracticeMode() {
    var ws = practiceMode.workspace;
    if (!ws) return;
    
    // 1. 取得最新程式碼
    var code = '';
    if (typeof Blockly.Arduino !== 'undefined' && Blockly.Arduino.workspaceToCode) {
        code = Blockly.Arduino.workspaceToCode(ws);
    }
    
    if (!code || code.trim().length === 0) {
        // 沒有程式碼，不進入練習模式
        return;
    }
    
    // 2. 設定狀態
    practiceMode.isActive = true;
    practiceMode.standardCode = code;
    practiceMode.normalizedStandard = normalizeCode(code);
    practiceMode.results = [];
    
    // 2.5. 鎖定工作區（唯讀）- 多層防護
    if (ws.options) {
        ws.options.readOnly = true;
    }
    if (ws.setEnabled) {
        ws.setEnabled(false);
    }
    // 在 Blockly div 上覆蓋灰色遮罩（最保險）
    var blocklyDiv = document.getElementById('blocklyDiv');
    if (blocklyDiv && !document.getElementById('blocklyReadOnlyOverlay')) {
        var overlay = document.createElement('div');
        overlay.id = 'blocklyReadOnlyOverlay';
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:999;background:rgba(0,0,0,0.3);';
        blocklyDiv.style.position = 'relative';
        blocklyDiv.appendChild(overlay);
    }
    // 在 blocklyDiv 本身加上 cursor 與 title（因為 overlay 是 pointer-events:none）
    if (blocklyDiv) {
        blocklyDiv.style.cursor = 'not-allowed';
        blocklyDiv.title = getI18n('PRACTICE_READONLY_HINT', '請先退出練習模式才能編輯積木');
    }
    
    // 3. 隱藏程式碼預覽，顯示練習容器
    var codeContent = document.getElementById('codeContent');
    var practiceContainer = document.getElementById('practiceContainer');
    var codeHeader = document.getElementById('codeHeader');
    
    if (codeContent) codeContent.style.display = 'none';
    if (practiceContainer) practiceContainer.style.display = 'flex';
    
    // 4. 隱藏「✍️ 練習」按鈕，顯示「退出練習」按鈕及「作弊」按鈕
    var btnPractice = document.getElementById('btn-practice');
    var btnExitPractice = document.getElementById('btn-exit-practice');
    var btnCheat = document.getElementById('btn-cheat');
    if (btnPractice) btnPractice.style.display = 'none';
    if (btnExitPractice) btnExitPractice.style.display = 'inline-block';
    if (btnCheat) btnCheat.style.display = 'inline-flex';
    
    // 5. 清空 textarea 並聚焦
    var textarea = document.getElementById('practiceTextarea');
    if (textarea) {
        textarea.value = '';
        practiceMode.studentTextarea = textarea;
        textarea.focus();
    }
    
    // 6. 重置行號
    var lineNumbers = document.getElementById('practiceLineNumbers');
    if (lineNumbers) {
        lineNumbers.innerHTML = '<div class="practice-line-num">1</div>';
    }
    
    // 7. 隱藏提示
    hideHintPopup();
    
    console.log('[PracticeMode] Entered practice mode');
}

/**
 * 退出練習模式
 */
function exitPracticeMode() {
    // 1. 重置狀態
    practiceMode.isActive = false;
    practiceMode.standardCode = '';
    practiceMode.normalizedStandard = [];
    practiceMode.results = [];
    practiceMode.studentTextarea = null;
    
    // 1.5. 恢復工作區（可編輯）
    if (practiceMode.workspace) {
        if (practiceMode.workspace.options) {
            practiceMode.workspace.options.readOnly = false;
        }
        if (practiceMode.workspace.setEnabled) {
            practiceMode.workspace.setEnabled(true);
        }
        // 移除遮罩並恢復 blocklyDiv 樣式
        var overlay = document.getElementById('blocklyReadOnlyOverlay');
        if (overlay) overlay.remove();
        var blocklyDiv = document.getElementById('blocklyDiv');
        if (blocklyDiv) {
            blocklyDiv.style.cursor = '';
            blocklyDiv.title = '';
        }
    }
    
    // 2. 顯示程式碼預覽，隱藏練習容器
    var codeContent = document.getElementById('codeContent');
    var practiceContainer = document.getElementById('practiceContainer');
    
    if (codeContent) codeContent.style.display = '';
    if (practiceContainer) practiceContainer.style.display = 'none';
    
    // 3. 顯示「✍️ 練習」按鈕，隱藏「退出練習」及「作弊」按鈕
    var btnPractice = document.getElementById('btn-practice');
    var btnExitPractice = document.getElementById('btn-exit-practice');
    var btnCheat = document.getElementById('btn-cheat');
    if (btnPractice) btnPractice.style.display = '';
    if (btnExitPractice) btnExitPractice.style.display = 'none';
    if (btnCheat) {
        btnCheat.style.display = 'none';
        btnCheat.classList.remove('active');
    }
    
    // 4. 隱藏作弊浮動視窗
    var cheatOverlay = document.getElementById('cheatOverlay');
    if (cheatOverlay) cheatOverlay.style.display = 'none';
    
    // 5. 隱藏提示
    hideHintPopup();
    
    console.log('[PracticeMode] Exited practice mode');
}

// ============================================================
// 事件監聽
// ============================================================

/**
 * 處理 textarea 的 keydown 事件
 * @param {Event} event
 */
function handleTextareaKeydown(event) {
    // Enter：觸發比對
    if (event.key === 'Enter') {
        // 讓 textarea 先處理換行，然後在下一幀觸發比對
        setTimeout(function() {
            triggerCheck();
        }, 0);
    }
    
    // Esc：退出練習
    if (event.key === 'Escape') {
        exitPracticeMode();
        event.preventDefault();
    }
    
    // F2：顯示提示
    if (event.key === 'F2') {
        var textarea = practiceMode.studentTextarea;
        if (textarea) {
            showHint(textarea.selectionStart);
        }
        event.preventDefault();
    }
}

/**
 * 處理 textarea 的 input 事件（即時更新行號）
 */
function handleTextareaInput() {
    // 更新行號
    var textarea = practiceMode.studentTextarea;
    if (!textarea) return;
    
    var lines = textarea.value.split('\n');
    var lineNumbers = document.getElementById('practiceLineNumbers');
    if (lineNumbers) {
        var html = '';
        for (var i = 0; i < lines.length; i++) {
            html += '<div class="practice-line-num">' + (i + 1) + '</div>';
        }
        lineNumbers.innerHTML = html;
    }
    
    // 隱藏提示（學生正在打字）
    hideHintPopup();
}

/**
 * 觸發比對檢查
 */
function triggerCheck() {
    var textarea = practiceMode.studentTextarea;
    if (!textarea) return;
    
    var studentCode = textarea.value;
    var results = checkStudentProgress(studentCode);
    practiceMode.results = results;
    
    // 套用樣式
    applyLineStyles();
    
    // 檢查是否完成
    if (results.length > 0) {
        var allCorrect = true;
        for (var i = 0; i < results.length; i++) {
            if (results[i].status !== 'correct') {
                allCorrect = false;
                break;
            }
        }
        
        if (allCorrect && results.length === practiceMode.normalizedStandard.length) {
            showCompletionMessage();
        }
    }
}

// ============================================================
// 初始化
// ============================================================

/**
 * 初始化練習模式
 * @param {Object} workspace - Blockly 工作區
 */
function initPracticeMode(workspace) {
    if (!workspace) return;
    
    practiceMode.workspace = workspace;
    
    // 1. 建立練習容器（如果不存在）
    ensurePracticeUI();
    
    // 2. 綁定「✍️ 練習」按鈕
    var btnPractice = document.getElementById('btn-practice');
    if (btnPractice) {
        btnPractice.addEventListener('click', togglePracticeMode);
    }
    
    // 3. 綁定「退出練習」按鈕
    var btnExitPractice = document.getElementById('btn-exit-practice');
    if (btnExitPractice) {
        btnExitPractice.addEventListener('click', exitPracticeMode);
    }
    
    // 4. 綁定「作弊」按鈕
    var btnCheat = document.getElementById('btn-cheat');
    if (btnCheat) {
        btnCheat.addEventListener('click', toggleCheat);
        bindCheatHover();
        initCheatDrag();
        bindCheatClose();
    }
    
    // 5. 綁定 textarea 事件
    var textarea = document.getElementById('practiceTextarea');
    if (textarea) {
        textarea.addEventListener('keydown', handleTextareaKeydown);
        textarea.addEventListener('input', handleTextareaInput);
    }
    
    console.log('[PracticeMode] Initialized');
}

/**
 * 確保練習模式 UI 存在（若 index.html 已定義則跳過）
 */
function ensurePracticeUI() {
    if (document.getElementById('practiceContainer')) return;
    
    // 如果 index.html 已包含練習容器，不需要動態建立
    // 此函式保留以備未來動態載入使用
}