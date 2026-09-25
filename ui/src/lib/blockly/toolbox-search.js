/// CodeBridge Toolbox Block Search
/// 依實際 toolbox 建立可搜尋的 block definition 索引。
(function() {
  'use strict';
  var state = {
    workspace: null,
    definitions: new Map(),
    searchText: new Map(),
    input: null,
    clearButton: null,
    status: null,
    composing: false,
    initialized: false
  };

  function normalize(value) {
    return String(value || '').toLowerCase().trim();
  }

  function addText(target, type, value) {
    value = normalize(value);
    if (value && value.indexOf('%') === -1) {
      target.searchText.set(type, (target.searchText.get(type) || '') + ' ' + value);
    }
  }

  function collectJson(items, categoryName, target) {
    (items || []).forEach(function(item) {
      var kind = String(item.kind || '').toUpperCase();
      if (kind === 'BLOCK' && item.type && !target.definitions.has(item.type)) {
        target.definitions.set(item.type, item);
        addText(target, item.type, item.type);
        addText(target, item.type, categoryName);
      } else if (kind === 'CATEGORY' && item.contents) {
        collectJson(item.contents, item.name || categoryName, target);
      } else if (item.contents) {
        collectJson(item.contents, categoryName, target);
      }
    });
  }

  function collectLanguageTree(languageTree, target) {
    if (!languageTree) return;
    if (languageTree.contents) {
      collectJson(languageTree.contents, '', target);
    } else if (languageTree.tagName) {
      Array.from(languageTree.querySelectorAll('category')).forEach(function(category) {
        var name = category.getAttribute('name') || '';
        Array.from(category.children).forEach(function(block) {
          if (String(block.tagName).toLowerCase() !== 'block') return;
          var type = block.getAttribute('type');
          if (!type || target.definitions.has(type)) return;
          target.definitions.set(type, { kind: 'block', type: type });
          addText(target, type, type);
          addText(target, type, name);
        });
      });
    }
  }

  function getDefinitions(workspace) {
    var target = { definitions: new Map(), searchText: new Map() };
    collectLanguageTree(workspace.options.languageTree, target);
    return target;
  }

  var TEMP_BLOCK_SKIP = new Set(['controls_for']);

  function buildBlob(workspace, type) {
    var text = type.toLowerCase();
    var definition = Blockly.Blocks[type];
    if (definition) {
      for (var i = 0; i < 5; i++) {
        var message = definition['message' + i];
        if (typeof message === 'string') {
          text += ' ' + Blockly.utils.parsing.replaceMessageReferences(message);
        }
      }
      if (typeof definition.tooltip === 'string') {
        text += ' ' + Blockly.utils.parsing.replaceMessageReferences(definition.tooltip);
      }
    }
    if (TEMP_BLOCK_SKIP.has(type)) return normalize(text);
    var temporaryBlock = null;
    try {
      temporaryBlock = workspace.newBlock(type);
      if (temporaryBlock) {
        (temporaryBlock.inputList || []).forEach(function(input) {
          (input.fieldRow || []).forEach(function(field) {
            if (field && field.getText) text += ' ' + field.getText();
          });
        });
      }
    } catch (error) {
      // 動態 block 仍可使用 type 與 message 索引。
    } finally {
      if (temporaryBlock) temporaryBlock.dispose(false);
    }
    return normalize(text);
  }

  function buildIndex(workspace) {
    if (!workspace || !Blockly || !Blockly.Blocks) return 0;
    var definitions = getDefinitions(workspace);
    Blockly.Events.disable();
    try {
      definitions.definitions.forEach(function(definition, type) {
        state.definitions.set(type, definition);
        state.searchText.set(type, definitions.searchText.get(type) + ' ' + buildBlob(workspace, type));
      });
    } finally {
      Blockly.Events.enable();
    }
    return state.definitions.size;
  }

  function search(query) {
    var normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];
    var keywords = normalizedQuery.split(/\s+/).filter(function(keyword) {
      return keyword.length > 0;
    });
    var results = [];
    state.searchText.forEach(function(blob, type) {
      var matches = keywords.every(function(keyword) {
        return blob.indexOf(keyword) !== -1;
      });
      if (matches && state.definitions.has(type)) {
        results.push(state.definitions.get(type));
      }
    });
    return results.slice(0, 30);
  }

  function setStatus(message) {
    if (!state.status) return;
    state.status.textContent = message || '';
    state.status.hidden = !message;
  }

  function applySearch(query) {
    if (!state.workspace || !state.input) return [];
    var results = search(query);
    var flyout = state.workspace.getFlyout && state.workspace.getFlyout();
    var hasQuery = Boolean(normalize(query));
    if (state.clearButton) state.clearButton.hidden = !hasQuery;
    if (!hasQuery) {
      if (flyout) flyout.hide();
      setStatus('');
      return [];
    }
    if (!results.length) {
      if (flyout) flyout.hide();
      setStatus(getI18n('TLB_BLOCK_SEARCH_NO_RESULTS', 'No matching blocks'));
      return [];
    }
    setStatus('');
    if (flyout) {
      flyout.show(results);
      if (flyout.setX) {
        var toolboxElement = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
        var width = toolboxElement
          ? toolboxElement.offsetWidth
          : state.workspace.getToolbox().getWidth();
        flyout.setX(width);
      }
    }
    return results;
  }

  function setQuery(query) {
    if (state.input) state.input.value = String(query || '');
    return applySearch(query);
  }

  function clear() {
    setQuery('');
    if (state.input) state.input.focus();
  }

  function injectSearchBox(workspace) {
    var toolboxElement = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
    if (!toolboxElement) return false;
    if (document.getElementById('block-search-container')) return true;

    var container = document.createElement('div');
    container.id = 'block-search-container';
    container.innerHTML = '<div class="search-input-wrapper">' +
      '<input type="text" id="block-search" autocomplete="off" ' +
      'aria-label="' + getI18n('TLB_BLOCK_SEARCH', 'Search blocks') + '">' +
      '<button type="button" id="block-search-clear" hidden ' +
      'aria-label="' + getI18n('TLB_BLOCK_SEARCH_CLEAR', 'Clear search') + '">' +
      '<img src="src/icons/cancel_24dp_FE2F89.png" alt="">' +
      '</button></div>' +
      '<div id="block-search-status" role="status" aria-live="polite" hidden></div>';
    toolboxElement.insertBefore(container, toolboxElement.firstChild);

    state.workspace = workspace;
    state.input = document.getElementById('block-search');
    state.input.placeholder = getI18n('TLB_BLOCK_SEARCH_PLACEHOLDER', 'Search blocks');
    state.clearButton = document.getElementById('block-search-clear');
    state.status = document.getElementById('block-search-status');
    ['click', 'mousedown', 'pointerdown', 'touchstart'].forEach(function(eventName) {
      container.addEventListener(eventName, function(event) {
        event.stopPropagation();
      });
    });
    state.input.addEventListener('compositionstart', function() {
      state.composing = true;
    });
    state.input.addEventListener('compositionend', function(event) {
      state.composing = false;
      applySearch(event.target.value);
    });
    state.input.addEventListener('input', function(event) {
      if (!state.composing) applySearch(event.target.value);
    });
    state.input.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setQuery('');
        state.input.blur();
      }
    });
    state.clearButton.addEventListener('click', function(event) {
      event.preventDefault();
      clear();
    });
    workspace.addChangeListener(function(event) {
      if (event.type === Blockly.Events.BLOCK_CREATE && state.input.value) {
        window.setTimeout(function() {
          setQuery('');
          state.input.blur();
        }, 100);
      }
    });
    return true;
  }

  window.CodeBridgeBlockSearch = {
    initialized: false,
    init: function(workspace) {
      if (this.initialized && state.workspace === workspace) return;
      state.definitions.clear();
      state.searchText.clear();
      buildIndex(workspace);
      injectSearchBox(workspace);
      this.initialized = true;
    },
    buildIndex: function(workspace) {
      state.definitions.clear();
      state.searchText.clear();
      return buildIndex(workspace || state.workspace);
    },
    search: search,
    setQuery: setQuery,
    clear: clear,
    refresh: function(workspace) {
      var target = workspace || state.workspace;
      if (!target) return;
      this.buildIndex(target);
      injectSearchBox(target);
      if (state.input) applySearch(state.input.value);
    }
  };
})();