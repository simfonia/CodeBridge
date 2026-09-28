// CodeBridge Arduino Generator 核心
// 對齊 piBlockly 的 generators/_core.js
// 負責 Blockly.Arduino generator 初始化、finish 組裝、scrub_ 串接

Blockly.Arduino = new Blockly.Generator('Arduino');

/**
 * 保留字清單。
 *
 * **AVR `<math.h>` 的函式名一定要在清單裡**（2026-09-28 使用者實測踩到）：
 * `double square(double)` 會讓全域變數 `int square` 編譯失敗：
 *
 *     error: 'int square' redeclared as different kind of symbol
 *     note: previous declaration 'double square(double)'
 *
 * 這類衝突很難從 CodeBridge 端診斷 —— 產出的 .ino 本身完全合理，
 * 只有交給 avr-gcc 才會爆錯。所以把 math.h 的常用函式全部列入，
 * 讓 `field_variable` 的下拉選單能標示出這些名字已被占用。
 */
Blockly.Arduino.addReservedWords(
    'setup,loop,if,else,for,switch,case,while,do,break,continue,return,goto,define,include,' +
    'HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,true,false,integer,constants,floating,point,void,' +
    'boolean,char,unsigned,byte,int,word,long,float,double,string,String,array,static,' +
    'volatile,const,sizeof,pinMode,digitalWrite,digitalRead,analogReference,analogRead,' +
    'analogWrite,tone,noTone,shiftOut,shitIn,pulseIn,millis,micros,delay,delayMicroseconds,' +
    'min,max,abs,constrain,map,pow,sqrt,sin,cos,tan,randomSeed,random,lowByte,highByte,' +
    'bitRead,bitWrite,bitSet,bitClear,bit,attachInterrupt,detachInterrupt,interrupts,noInterrupts,' +
    // AVR <math.h>：這些名字已被函式占用，變數取同名必定編譯失敗
    'square,cube,hypot,atan2,log,log2,log10,exp,expm1,log1p,pow,ceil,ceilf,floor,floorf,' +
    'fmod,fmodf,remainder,trunc,truncf,round,roundf,lround,lroundf,nearbyint,tgamma,tgammaf,' +
    'lgamma,isinf,isnan,isinf_sign,isnan_sign,isinf_m,' +
    // AVR <string.h> / <stdlib.h> 的常見函式
    'strcpy,strncpy,strcat,strncat,strcmp,strncmp,strlen,strstr,strchr,memcpy,memset,memcmp,' +
    'atoi,atol,atof,abs,labs,div,ldiv,rand,srand,exit,malloc,free,calloc,realloc,' +
    // Arduino 內建巨集
    'LED_BUILTIN,ledSetup,ledLoop,serialEvent,serialEventRun,Keyboard,Mouse,Stream,Client,Server'
);

Blockly.Arduino.ORDER_ATOMIC = 0;
Blockly.Arduino.ORDER_NEW = 1.1;
Blockly.Arduino.ORDER_MEMBER = 1.2;
Blockly.Arduino.ORDER_FUNCTION_CALL = 2;
Blockly.Arduino.ORDER_INCREMENT = 3;
Blockly.Arduino.ORDER_DECREMENT = 3;
Blockly.Arduino.ORDER_BITWISE_NOT = 4.1;
Blockly.Arduino.ORDER_UNARY_PLUS = 4.2;
Blockly.Arduino.ORDER_UNARY_NEGATION = 4.3;
Blockly.Arduino.ORDER_LOGICAL_NOT = 4.4;
Blockly.Arduino.ORDER_TYPEOF = 4.5;
Blockly.Arduino.ORDER_VOID = 4.6;
Blockly.Arduino.ORDER_DELETE = 4.7;
Blockly.Arduino.ORDER_AWAIT = 4.8;
Blockly.Arduino.ORDER_EXPONENTIATION = 5;
Blockly.Arduino.ORDER_MULTIPLICATION = 5.1;
Blockly.Arduino.ORDER_DIVISION = 5.2;
Blockly.Arduino.ORDER_MODULUS = 5.3;
Blockly.Arduino.ORDER_SUBTRACTION = 6.1;
Blockly.Arduino.ORDER_ADDITION = 6.2;
Blockly.Arduino.ORDER_BITWISE_SHIFT = 7;
Blockly.Arduino.ORDER_RELATIONAL = 8;
Blockly.Arduino.ORDER_IN = 8;
Blockly.Arduino.ORDER_INSTANCEOF = 8;
Blockly.Arduino.ORDER_EQUALITY = 9;
Blockly.Arduino.ORDER_BITWISE_AND = 10;
Blockly.Arduino.ORDER_BITWISE_XOR = 11;
Blockly.Arduino.ORDER_BITWISE_OR = 12;
Blockly.Arduino.ORDER_LOGICAL_AND = 13;
Blockly.Arduino.ORDER_LOGICAL_OR = 14;
Blockly.Arduino.ORDER_CONDITIONAL = 15;
Blockly.Arduino.ORDER_ASSIGNMENT = 16;
Blockly.Arduino.ORDER_YIELD = 17;
Blockly.Arduino.ORDER_COMMA = 18;
Blockly.Arduino.ORDER_NONE = 99;

// =============================================================================
// ID 標記常數（用於程式碼定位）
// =============================================================================
Blockly.Arduino.ID_MARKER = '// __BLOCKLY_ID:';
Blockly.Arduino.ID_MARKER_END = '__';

// Value blocks are expressions embedded in a parent statement. Add a
// removable C++ block comment so selecting a value block can still locate
// its generated source line without changing the generated expression.
var codeBridgeValueToCode = Blockly.Arduino.valueToCode;
Blockly.Arduino.valueToCode = function(block, inputName, order) {
  var code = codeBridgeValueToCode.call(this, block, inputName, order);
  var valueBlock = block && block.getInputTargetBlock(inputName);
  var isShadow = valueBlock && valueBlock.isShadow && valueBlock.isShadow();
  var canMark = valueBlock && valueBlock.id &&
    !isShadow && valueBlock.type !== 'math_number';
  if (typeof code === 'string' && canMark) {
    return code + '/* ' + Blockly.Arduino.ID_MARKER + valueBlock.id +
      Blockly.Arduino.ID_MARKER_END + ' */';
  }
  return code;
};

// =============================================================================
// 程式碼籃子（Code Buckets）初始化與組裝
// =============================================================================

Blockly.Arduino.init = function(workspace) {
  // 建立程式碼籃子
  Blockly.Arduino.includes_ = Object.create(null);
  Blockly.Arduino.macros_ = Object.create(null);
  Blockly.Arduino.global_vars_ = Object.create(null);
  Blockly.Arduino.function_prototypes_ = Object.create(null);
  Blockly.Arduino.function_definitions_ = Object.create(null);
  Blockly.Arduino.definitions_ = Object.create(null);
  Blockly.Arduino.setups_ = Object.create(null);
  Blockly.Arduino.setupsBlockId_ = null;
  Blockly.Arduino.loopBlockId_ = null;

  // 初始化縮排設定（使用 Blockly 標準 INDENT）
  Blockly.Arduino.INDENT = '  ';  // 兩個空格，可依需求調整為 '\t' 或 '    '

  if (!Blockly.Arduino.variableDB_) {
    Blockly.Arduino.variableDB_ = new Blockly.Names(Blockly.Arduino.RESERVED_WORDS_);
  } else {
    Blockly.Arduino.variableDB_.reset();
  }
  Blockly.Arduino.variableDB_.setVariableMap(workspace.getVariableMap());
};

Blockly.Arduino.finish = function(code) {
  // 'code' 參數是 loop() 函式的內容
  // 按正確順序組裝完整的 .ino 程式碼

  // 1. Includes
  const includes = Object.values(Blockly.Arduino.includes_).join('\n');
  // 2. Macros
  const macros = Object.values(Blockly.Arduino.macros_).join('\n');
  // 3. Global variables
  const globalVars = Object.values(Blockly.Arduino.global_vars_).join('\n');
  // 4. Other definitions
  const definitions = Object.values(Blockly.Arduino.definitions_).join('\n\n');
  // 5. Function prototypes
  const funcPrototypes = Object.values(Blockly.Arduino.function_prototypes_).join('\n');
  // 6. Function definitions
  const funcDefinitions = Object.values(Blockly.Arduino.function_definitions_).join('\n\n');

  // 7. Setup function - 只有當有內容或有設定 setup 積木存在時才輸出
  var setupFunc = '';
  var setups = Object.values(Blockly.Arduino.setups_);
  if (Blockly.Arduino.setupsBlockId_ || setups.length > 0) {
    var setupCode = setups.length > 0 ? Blockly.Arduino.prefixLines(setups.join('\n'), Blockly.Arduino.INDENT) : '';
    var setupId = Blockly.Arduino.setupsBlockId_ ? ' ' + Blockly.Arduino.ID_MARKER + Blockly.Arduino.setupsBlockId_ + Blockly.Arduino.ID_MARKER_END : '';
    setupFunc = 'void setup() {' + setupId + '\n' + setupCode + '\n}\n';
  }

  // 8. Loop function - 只有當有內容或有設定 loop 積木存在時才輸出
  var loopFunc = '';
  if (Blockly.Arduino.loopBlockId_ || (code && code.trim())) {
    var loopId = Blockly.Arduino.loopBlockId_ ? ' ' + Blockly.Arduino.ID_MARKER + Blockly.Arduino.loopBlockId_ + Blockly.Arduino.ID_MARKER_END : '';
    var loopContent = code ? Blockly.Arduino.prefixLines(code, Blockly.Arduino.INDENT) : '';
    loopFunc = 'void loop() {' + loopId + '\n' + loopContent + '\n}\n';
  }

  // 組裝最終程式碼
  var finalCode = '// Includes\n' + includes + '\n\n';
  if (macros) {
    finalCode += '// Macros\n' + macros + '\n\n';
  }
  finalCode += '// Global variables\n' + globalVars + '\n\n';
  if (definitions) {
    finalCode += '// General definitions\n' + definitions + '\n\n';
  }
  if (funcPrototypes) {
    finalCode += '// Function prototypes\n' + funcPrototypes + '\n\n';
  }
  if (funcDefinitions) {
    finalCode += '// Function definitions\n' + funcDefinitions + '\n\n';
  }

  if (setupFunc) {
    finalCode += setupFunc + '\n';
  }
  if (loopFunc) {
    finalCode += loopFunc;
  }

  // 清理
  delete Blockly.Arduino.includes_;
  delete Blockly.Arduino.macros_;
  delete Blockly.Arduino.global_vars_;
  delete Blockly.Arduino.function_prototypes_;
  delete Blockly.Arduino.function_definitions_;
  delete Blockly.Arduino.definitions_;
  delete Blockly.Arduino.setups_;
  delete Blockly.Arduino.setupsBlockId_;
  delete Blockly.Arduino.loopBlockId_;
  Blockly.Arduino.variableDB_.reset();

  return finalCode;
};

Blockly.Arduino.scrubNakedValue = function(line) {
  return line + ';\n';
};

Blockly.Arduino.quote_ = function(string) {
  return '"' + string.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
};

/**
 * 串接 next block 的程式碼，並在每行程式碼行尾嵌入 ID 標記
 * 用於程式碼定位（statement 積木）
 */
Blockly.Arduino.scrub_ = function(block, code) {
  if (code) {
    // 在每行程式碼行尾插入 ID 標記（換行前）
    code = code.replace(/\n/g, ' ' + Blockly.Arduino.ID_MARKER + block.id + Blockly.Arduino.ID_MARKER_END + '\n');
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = Blockly.Arduino.blockToCode(nextBlock);
  return code + nextCode;
};

// =============================================================================
// 定義堆疊處理（Definition Stack）
// 對齊 piBlockly：media/generators/_lib.js 的 processDefinitionStack
//
// 為什麼需要這一层：宣告型積木（全域變數、全域原始定義）描述的是
// 「整個專案的型別宣告區」，使用者在畫面上會把它們用 next 串成一條連續的堆疊。
//
// piBlockly 的模型（CodeBridge 完全對齊）：
// 1. 堆疊**最上方**的積木觸發 generator，沿 next 走完整條堆疊
// 2. 整條堆疊的程式碼合併為 `global_vars_` 裡的**單一 entry**
//    （key 為 `stack_` + 堆頂積木 id）
// 3. 非堆頂的積木 `return ''`，避免重複產碼
//
// 這與「每個變數各自是一個獨立積木、各自寫一個 global_vars_ entry」不同。
// 堆疊模型的實際好處：
// - 畫面上就是一條連續的「型別宣告區」，語意清楚
// - 整條堆疊在 global_vars_ 裡是單一 entry，順序穩定，
//   不會被其他模組的 global_vars_ 寫入穿插打斷
//
// **為什麼要共用 `coding_raw_definition`**：兩者在 C++ 裡都是「全域宣告」，
// 可以合法地混在同一条堆疊上（`int x = 0;` 接 `const int LED = 13;`），
// 使用者不該被強制拆成兩條互不相干的堆疊。
// =============================================================================

/// 屬於「全域定義堆疊」的積木型別。
/// 與 piBlockly 的 DEFINITION_BLOCK_TYPES 保持一致。
Blockly.Arduino.DEFINITION_BLOCK_TYPES = [
  'variables_declare_global',
  'coding_raw_definition'
];

/**
 * 取得某個積木作為單一變數宣告時的 C++ 定義字串。
 *
 * 抽出成獨立函式是為了讓堆疊處理器能逐顆積木取得程式碼，
 * 且變數名稱的解析邏輯（VariableMap → 名稱 → 未知時的 fallback）
 * 只有一份實作，不會在兩處漂移。
 *
 * @param {!Blockly.Block} block `variables_declare_global` 積木
 * @return {string} 例如 `int counter = 0;`
 */
function blocklyArduinoGlobalVariableDefinition(block) {
  var type = block.getFieldValue('TYPE');
  var variable = block.workspace.getVariableMap()
    .getVariableById(block.getFieldValue('VAR'));
  // 變數被刪掉但積木還留著是常見狀態（使用者刪了變數但沒刪積木），
  // 此時產生可辨識的錯誤名稱，而不是靜默產生錯誤的 C++。
  var name = variable ? variable.name : 'UNKNOWN_VAR';
  var value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC);

  var defaultValue = '0';
  if (type === 'String') defaultValue = '""';
  else if (type === 'bool') defaultValue = 'false';

  var code = type + ' ' + name + ' = ' + (value || defaultValue) + ';';
  // 保險：valueToCode 可能回傳已帶分號的片段
  return code.slice(-1) === ';' ? code : code + ';';
}

/**
 * 處理一整條相連的定義積木堆疊。
 *
 * 由堆疊**最上方**的積木呼叫；會沿 `next` 走過所有同屬
 * `DEFINITION_BLOCK_TYPES` 的積木，把整條堆疊的程式碼合併後
 * 一次寫入 `global_vars_` 的單一 entry。
 *
 * 非堆頂積木（前一顆也是定義型）直接回傳空字串 —— 它的程式碼已由
 * 堆頂積木一併處理，再產一次就會重複定義。
 *
 * @param {!Blockly.Block} block 觸發本次呼叫的積木（應為堆疊最上方）
 * @return {string} 永回傳空字串（程式碼經由 global_vars_ bucket 輸出）
 */
function processDefinitionStack(block) {
  var previous = block.getPreviousBlock();
  if (previous && Blockly.Arduino.DEFINITION_BLOCK_TYPES.indexOf(previous.type) !== -1) {
    // 已由堆頂積木處理過，避免重複產碼
    return '';
  }

  var codes = [];
  var current = block;
  while (current && Blockly.Arduino.DEFINITION_BLOCK_TYPES.indexOf(current.type) !== -1) {
    var code = '';
    if (current.type === 'variables_declare_global') {
      code = blocklyArduinoGlobalVariableDefinition(current);
    } else if (current.type === 'coding_raw_definition') {
      code = current.getFieldValue('CODE') || '';
    }
    if (code) codes.push(code);
    current = current.getNextBlock();
  }

  if (codes.length > 0) {
    // 整條堆疊寫成單一 entry，確保它們在 global_vars_ 中保持相鄰與順序穩定。
    //
    // **不可在結尾補換行**：`finish()` 是以 `Object.values(...).join('\n')` 組裝
    // 各區段，若這裡多帶一個 `\n`，`// Global variables` 之後就會多出一個空行。
    // piBlockly 的 `processDefinitionStack` 有補 `'\n'`，但它的 finish()
    // 組裝方式與本專案不同，不能直接照搬。
    Blockly.Arduino.global_vars_['stack_' + block.id] = codes.join('\n');
  }
  return '';
}

Blockly.Arduino.globalVariableDefinition = blocklyArduinoGlobalVariableDefinition;
Blockly.Arduino.processDefinitionStack = processDefinitionStack;

// =============================================================================
// 孤兒積木檢測：允許放在根層級的積木類型
// =============================================================================
//
// 這份清單同時是「允許成為根層積木」與「不該單獨漂浮在工作區」的判斷依據
// （見 `main.js` 的 `updateOrphanBlocks`）。清單漏掉一個型別，症狀是：
// **該型別的積木被標記為 orphan 而停用，generator 因而不產生任何程式碼** ——
// 使用者看到的是「宣告了變數但 .ino 沒有型別定義」，完全無從聯想到孤兒檢測。
//
// 停用的積木不產碼這件事本身沒錯（漂浮的 `arduino_delay` 確實該忽略），
// 但**宣告型積木恰恰常被使用者放在根層**，因為它描述的是「整個專案的變數」，
// 塞進 setup 裡反而語意奇怪。因此它必須與 `array_declare_global` 一同列入。
Blockly.Arduino.scopeDefiningRootBlocks = [
  'initializes_setup',
  'initializes_loop',
  'coding_include',
  'coding_raw_definition',
  'coding_raw_wrapper',
  'array_declare_global',
  'variables_declare_global',
  'custom_functions_defreturn',
  'custom_functions_defnoreturn'
];