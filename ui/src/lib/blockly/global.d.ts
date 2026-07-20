/// 全域 Blockly 型別定義
/// Blockly v12.3.1 以全局變數形式載入

declare var Blockly: {
  Msg: Record<string, string>;
  Blocks: Record<string, any>;
  Arduino: {
    forBlock: Record<string, (block: any) => string | [string, number]>;
    valueToCode: (block: any, name: string, order: number) => string;
    statementToCode: (block: any, name: string) => string;
    ORDER_ATOMIC: number;
  };
  Processing: any;
  Themes: {
    Classic: any;
  };
  common: {
    getMainWorkspace(): any;
  };
  inject(container: HTMLElement | string, config: any): any;
  Events: {
    fire(event: any): void;
    getEventClass_(type: string): any;
    Ui: any;
  };
  registry: {
    register(type: string, name: string, plugin: any): void;
  };
};
