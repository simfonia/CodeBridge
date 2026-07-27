// CodeBridge Arduino Generator 核心
// 對齊 piBlockly 的 generators/_core.js
// 負責 Blockly.Arduino generator 初始化、finish 組裝、scrub_ 串接

Blockly.Arduino = new Blockly.Generator('Arduino');

Blockly.Arduino.addReservedWords(
    'setup,loop,if,else,for,switch,case,while,do,break,continue,return,goto,define,include,' +
    'HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,true,false,integer,constants,floating,point,void,' +
    'boolean,char,unsigned,byte,int,word,long,float,double,string,String,array,static,' +
    'volatile,const,sizeof,pinMode,digitalWrite,digitalRead,analogReference,analogRead,' +
    'analogWrite,tone,noTone,shiftOut,shitIn,pulseIn,millis,micros,delay,delayMicroseconds,' +
    'min,max,abs,constrain,map,pow,sqrt,sin,cos,tan,randomSeed,random,lowByte,highByte,' +
    'bitRead,bitWrite,bitSet,bitClear,bit,attachInterrupt,detachInterrupt,interrupts,noInterrupts'
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
// 孤兒積木檢測：允許放在根層級的積木類型
// =============================================================================

Blockly.Arduino.scopeDefiningRootBlocks = [
  'initializes_setup',
  'initializes_loop',
  'coding_include',
  'coding_raw_definition',
  'coding_raw_wrapper',
  'array_declare_global',
  'custom_functions_defreturn',
  'custom_functions_defnoreturn'
];