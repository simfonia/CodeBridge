/// CodeBridge Blockly XML migration helpers
/// 在 XML 輸入邊界將舊格式轉成目前 Blockly 13.3.0 mutation 屬性。

(function() {
  'use strict';

  function migrateControlsIfMutations(xmlElement) {
    var controlsIfBlocks = xmlElement.querySelectorAll('block[type="controls_if"]');
    for (var i = 0; i < controlsIfBlocks.length; i++) {
      var mutation = controlsIfBlocks[i].querySelector('mutation');
      if (!mutation) continue;

      var elseifCount = mutation.getAttribute('elseifCount');
      if (elseifCount !== null && mutation.getAttribute('elseif') === null) {
        mutation.setAttribute('elseif', elseifCount);
      }

      var elseCount = mutation.getAttribute('elseCount');
      if (elseCount !== null && mutation.getAttribute('else') === null) {
        mutation.setAttribute('else', elseCount);
      }
    }
  }

  function prepareXml(xmlElement) {
    migrateControlsIfMutations(xmlElement);
    return xmlElement;
  }

  function domToWorkspace(xmlElement, workspace) {
    prepareXml(xmlElement);
    return Blockly.Xml.domToWorkspace(xmlElement, workspace);
  }

  function textToWorkspace(xmlText, workspace) {
    return domToWorkspace(Blockly.utils.xml.textToDom(xmlText), workspace);
  }

  window.CodeBridgeBlocklyXml = {
    prepareXml: prepareXml,
    domToWorkspace: domToWorkspace,
    textToWorkspace: textToWorkspace
  };
})();
