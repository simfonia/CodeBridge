/// CodeBridge 影子積木定義
/// 腳位輸入影子積木，為需要腳位輸入的積木提供預設可編輯文字欄位

Blockly.Blocks['arduino_pin_shadow'] = {
  init: function() {
    this.jsonInit({
      type: 'arduino_pin_shadow',
      message0: '%{BKY_ARDUINO_PIN_LABEL} %1',
      args0: [
        {
          type: 'field_input',
          name: 'PIN',
          text: '',
          spellcheck: false
        }
      ],
      output: ['Number', 'String'],
      colour: '%{BKY_ARDUINO_CONTROL_HUE}',
      tooltip: '',
      helpUrl: ''
    });
  }
};