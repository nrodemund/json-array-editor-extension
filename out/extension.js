"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const jsonc_parser_1 = require("jsonc-parser");
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('jsonArrayEditor.editAtCursor', async (payload) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('JsonArrayEditor: No active editor.');
            return;
        }
        const document = editor.document;
        if (!['json', 'jsonc'].includes(document.languageId)) {
            vscode.window.showErrorMessage('JsonArrayEditor works on JSON/JSONC documents only.');
            return;
        }
        const cursorOffset = payload?.cursorOffset ?? document.offsetAt(editor.selection.active);
        const nestedPath = payload?.nestedPath;
        await JsonArrayEditorPanel.createOrShow(context.extensionUri, document, cursorOffset, nestedPath);
    }));
}
class JsonArrayEditorPanel {
    static async createOrShow(extensionUri, document, cursorOffset, nestedPath) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
        if (JsonArrayEditorPanel.currentPanel) {
            JsonArrayEditorPanel.currentPanel.panel.reveal(column);
            await JsonArrayEditorPanel.currentPanel.load(document, cursorOffset, nestedPath);
            return;
        }
        const panel = vscode.window.createWebviewPanel('jsonArrayEditor', 'JsonArrayEditor', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        JsonArrayEditorPanel.currentPanel = new JsonArrayEditorPanel(panel, extensionUri);
        await JsonArrayEditorPanel.currentPanel.load(document, cursorOffset, nestedPath);
    }
    constructor(panel, extensionUri) {
        this.disposables = [];
        this.activePath = [];
        this.rootPath = [];
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.type) {
                    case 'save':
                        await this.saveModel(message.model);
                        break;
                    case 'openChild':
                        if (!this.activeDocument) {
                            return;
                        }
                        await this.load(this.activeDocument, 0, message.path);
                        break;
                    case 'chooseChild':
                        if (!this.activeDocument) {
                            return;
                        }
                        await this.chooseChildPath(message.basePath);
                        break;
                    case 'goParent':
                        if (!this.activeDocument) {
                            return;
                        }
                        await this.goToParent();
                        break;
                    case 'refresh':
                        if (!this.activeDocument) {
                            return;
                        }
                        await this.load(this.activeDocument, 0, this.activePath);
                        break;
                }
            }
            catch (error) {
                const text = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`JsonArrayEditor: ${text}`);
            }
        }, null, this.disposables);
    }
    dispose() {
        JsonArrayEditorPanel.currentPanel = undefined;
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }
    async load(document, cursorOffset, nestedPath) {
        this.activeDocument = document;
        const text = document.getText();
        const root = (0, jsonc_parser_1.parseTree)(text);
        if (!root) {
            throw new Error('Could not parse JSON document.');
        }
        const targetNode = nestedPath ? getNodeByPath(root, nestedPath) : findRelevantEditableNode(root, cursorOffset);
        if (!targetNode) {
            throw new Error('Cursor is not within a supported JSON array or standalone object.');
        }
        let model;
        if (targetNode.type === 'array') {
            const path = getNodePath(targetNode);
            model = buildModelFromArrayNode(targetNode, path);
            this.activePath = path;
            if (!nestedPath) {
                this.rootPath = [...path];
            }
        }
        else if (targetNode.type === 'object') {
            const path = getNodePath(targetNode);
            model = buildModelFromObjectNode(targetNode, path);
            this.activePath = path;
            if (!nestedPath) {
                this.rootPath = [...path];
            }
        }
        else {
            throw new Error('Cursor is not within a supported JSON array or standalone object.');
        }
        if (!this.rootPath.length) {
            this.rootPath = [...this.activePath];
        }
        model.rootPath = [...this.rootPath];
        this.panel.title = `JsonArrayEditor - ${document.fileName.split(/[\\/]/).pop() ?? 'JSON'}`;
        this.panel.webview.postMessage({
            type: 'load',
            model,
            fileName: document.fileName,
            pathLabel: pathToLabel(this.activePath),
            rootLabel: pathToLabel(this.rootPath),
        });
    }
    async chooseChildPath(basePath) {
        if (!this.activeDocument) {
            return;
        }
        const text = this.activeDocument.getText();
        const root = (0, jsonc_parser_1.parseTree)(text);
        if (!root) {
            throw new Error('Could not parse JSON document.');
        }
        const node = getNodeByPath(root, basePath);
        if (!node) {
            throw new Error('Could not resolve child source node.');
        }
        const picks = [];
        if (node.type === 'object') {
            for (const child of node.children ?? []) {
                const keyNode = child.children?.[0];
                const valueNode = child.children?.[1];
                const key = keyNode ? (0, jsonc_parser_1.getNodeValue)(keyNode) : undefined;
                if (typeof key === 'string' && valueNode?.type === 'array' && isSupportedArray(valueNode)) {
                    picks.push({
                        label: key,
                        description: pathToLabel([...basePath, key]),
                        path: [...basePath, key],
                    });
                }
            }
        }
        else if (node.type === 'array') {
            const value = (0, jsonc_parser_1.getNodeValue)(node);
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                        for (const key of Object.keys(item)) {
                            const childValue = item[key];
                            if (Array.isArray(childValue)) {
                                const childNode = getNodeByPath(root, [...basePath, i, key]);
                                if (childNode?.type === 'array' && isSupportedArray(childNode)) {
                                    picks.push({
                                        label: `${key} (row ${i + 1})`,
                                        description: pathToLabel([...basePath, i, key]),
                                        path: [...basePath, i, key],
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        if (picks.length === 0) {
            vscode.window.showInformationMessage('JsonArrayEditor: no supported child arrays found here.');
            return;
        }
        const pick = await vscode.window.showQuickPick(picks.map((item) => ({
            label: item.label,
            description: item.description,
            item,
        })), {
            placeHolder: 'Open child array',
        });
        if (!pick) {
            return;
        }
        await this.load(this.activeDocument, 0, pick.item.path);
    }
    async goToParent() {
        if (!this.activeDocument) {
            return;
        }
        const text = this.activeDocument.getText();
        const root = (0, jsonc_parser_1.parseTree)(text);
        if (!root) {
            throw new Error('Could not parse JSON document.');
        }
        const parentPath = findNearestEditableParentPath(root, this.activePath, this.rootPath);
        if (!parentPath) {
            return;
        }
        await this.load(this.activeDocument, 0, parentPath);
    }
    async saveModel(model) {
        if (!this.activeDocument) {
            throw new Error('No active document loaded.');
        }
        const editor = await vscode.window.showTextDocument(this.activeDocument, { preview: false, preserveFocus: true });
        const currentText = this.activeDocument.getText();
        const newValue = materializeValue(model);
        const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 2;
        const edits = (0, jsonc_parser_1.modify)(currentText, model.path, newValue, {
            formattingOptions: {
                insertSpaces: true,
                tabSize,
            },
            getInsertionIndex: undefined,
        });
        const updatedText = (0, jsonc_parser_1.applyEdits)(currentText, edits);
        const fullRange = new vscode.Range(this.activeDocument.positionAt(0), this.activeDocument.positionAt(currentText.length));
        await editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, updatedText);
        });
        await this.activeDocument.save();
        this.rootPath = [...model.rootPath];
        await this.load(this.activeDocument, 0, model.path);
        vscode.window.showInformationMessage('JsonArrayEditor: changes saved.');
    }
    getHtml() {
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JsonArrayEditor</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 12px;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    button, select, input[type="text"], input[type="number"] {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
      padding: 6px 8px;
    }
    button {
      cursor: pointer;
      white-space: nowrap;
    }
    button:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .meta {
      margin-bottom: 8px;
      opacity: 0.85;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid var(--vscode-panel-border);
      padding: 6px;
      vertical-align: top;
    }
    th {
      background: var(--vscode-sideBar-background);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .cellWrap {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .cellWrap input[type="text"], .cellWrap input[type="number"], .cellWrap select {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }
    .columnHeader {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .columnNameRow {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .columnNameRow input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .iconBtn {
      padding: 4px 8px;
      line-height: 1;
      flex: 0 0 auto;
    }
    .menuBtn {
      padding: 4px 6px;
      min-width: 28px;
      line-height: 1;
      flex: 0 0 auto;
    }
    .popupMenu {
      position: fixed;
      z-index: 9999;
      min-width: 180px;
      max-width: 320px;
      max-height: 260px;
      overflow: auto;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
      border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    }
    .popupItem {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 6px 8px;
      color: inherit;
    }
    .popupItem:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .rowActions {
      width: 220px;
      white-space: nowrap;
    }
    .rowActionsInner {
      display: inline-flex;
      gap: 6px;
      flex-wrap: nowrap;
      white-space: nowrap;
      align-items: center;
    }
    .small {
      font-size: 0.9em;
      opacity: 0.8;
    }
    .danger {
      color: var(--vscode-errorForeground);
    }
    .searchField {
      min-width: 220px;
    }
    .matchHidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="meta" id="meta"></div>
  <div class="toolbar">
    <button id="saveBtn">Save</button>
    <button id="refreshBtn">Refresh</button>
    <button id="goParentBtn">Go to parent</button>
    <button id="addRowBtn">Add row</button>
    <button id="addColumnBtn">Add column</button>
    <input id="searchInput" class="searchField" type="text" placeholder="Search..." />
    <span class="small" id="kindLabel"></span>
  </div>
  <div id="tableHost"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let model = null;
    let currentFileName = '';
    let currentPathLabel = '';
    let currentRootLabel = '';
    let searchTerm = '';
    let activePopup = null;

    const meta = document.getElementById('meta');
    const kindLabel = document.getElementById('kindLabel');
    const tableHost = document.getElementById('tableHost');
    const addRowBtn = document.getElementById('addRowBtn');
    const goParentBtn = document.getElementById('goParentBtn');
    const searchInput = document.getElementById('searchInput');

    document.addEventListener('click', (event) => {
      if (!activePopup) return;
      if (!activePopup.contains(event.target)) {
        activePopup.remove();
        activePopup = null;
      }
    });

    document.getElementById('saveBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'save', model });
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    goParentBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'goParent' });
    });

    addRowBtn.addEventListener('click', () => addRow());

    document.getElementById('addColumnBtn').addEventListener('click', () => addColumn());

    searchInput.addEventListener('input', () => {
      searchTerm = (searchInput.value || '').toLowerCase();
      render(currentFileName, currentPathLabel, currentRootLabel);
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'load') {
        model = msg.model;
        currentFileName = msg.fileName;
        currentPathLabel = msg.pathLabel;
        currentRootLabel = msg.rootLabel;
        render(msg.fileName, msg.pathLabel, msg.rootLabel);
      }
    });

    function render(fileName, pathLabel, rootLabel) {
      if (!model) {
        tableHost.innerHTML = '<p>No model loaded.</p>';
        return;
      }

      meta.textContent = fileName + '  •  ' + pathLabel;
      goParentBtn.disabled = pathLabel === rootLabel;
      addRowBtn.style.display = model.kind === 'single-object' ? 'none' : '';

      if (model.kind === 'object-array') {
        kindLabel.textContent = 'Object array';
      } else if (model.kind === 'primitive-array') {
        kindLabel.textContent = 'Primitive array';
      } else {
        kindLabel.textContent = 'Single object';
      }

      if (activePopup) {
        activePopup.remove();
        activePopup = null;
      }

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const hRow = document.createElement('tr');

      model.columns.forEach((column, colIndex) => {
        const th = document.createElement('th');
        const wrap = document.createElement('div');
        wrap.className = 'columnHeader';

        const nameRow = document.createElement('div');
        nameRow.className = 'columnNameRow';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = column.key;
        nameInput.title = 'Column name';
        nameInput.addEventListener('change', () => renameColumn(colIndex, nameInput.value));

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'iconBtn danger';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove column';
        removeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          removeColumn(colIndex);
        });

        const typeSelect = document.createElement('select');
        ['text', 'number', 'bool', 'color'].forEach((t) => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          if (column.type === t) opt.selected = true;
          typeSelect.appendChild(opt);
        });
        typeSelect.addEventListener('change', () => {
          model.columns[colIndex].type = typeSelect.value;
          render(fileName, pathLabel, rootLabel);
        });

        nameRow.appendChild(nameInput);
        nameRow.appendChild(removeBtn);
        wrap.appendChild(nameRow);
        wrap.appendChild(typeSelect);
        th.appendChild(wrap);
        hRow.appendChild(th);
      });

      const actionsTh = document.createElement('th');
      actionsTh.className = 'rowActions';
      actionsTh.textContent = 'Actions';
      hRow.appendChild(actionsTh);

      thead.appendChild(hRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      model.rows.forEach((row, rowIndex) => {
        const rowMatches = rowMatchesSearch(row, rowIndex);
        const tr = document.createElement('tr');
        if (!rowMatches) {
          tr.className = 'matchHidden';
        }

        model.columns.forEach((column) => {
          const td = document.createElement('td');
          td.appendChild(renderCell(row, rowIndex, column));
          tr.appendChild(td);
        });

        const actionsTd = document.createElement('td');
        actionsTd.className = 'rowActions';
        const actionsInner = document.createElement('div');
        actionsInner.className = 'rowActionsInner';

        if (model.kind !== 'single-object') {
          const cloneBtn = document.createElement('button');
          cloneBtn.textContent = 'Clone row';
          cloneBtn.addEventListener('click', () => cloneRow(rowIndex));
          actionsInner.appendChild(cloneBtn);

          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.className = 'danger';
          deleteBtn.addEventListener('click', () => deleteRow(rowIndex));
          actionsInner.appendChild(deleteBtn);
        } else {
          actionsInner.appendChild(document.createTextNode('—'));
        }

        if (hasNamedChildArrays(row)) {
          const openNamedChildBtn = document.createElement('button');
          openNamedChildBtn.textContent = 'Open child';
          openNamedChildBtn.addEventListener('click', () => openNamedChild(rowIndex));
          actionsInner.appendChild(openNamedChildBtn);
        }

        actionsTd.appendChild(actionsInner);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      tableHost.innerHTML = '';
      tableHost.appendChild(table);
    }

    function rowMatchesSearch(row, rowIndex) {
      if (!searchTerm) {
        return true;
      }

      const haystack = [];

      for (const column of model.columns) {
        haystack.push(column.key);
        haystack.push(stringifyForSearch(row[column.key]));
      }

      haystack.push(String(rowIndex + 1));

      return haystack.join(' ').toLowerCase().includes(searchTerm);
    }

    function stringifyForSearch(value) {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    function hasNamedChildArrays(row) {
      if (!row || typeof row !== 'object') {
        return false;
      }
      return Object.keys(row).some((key) => Array.isArray(row[key]));
    }

    function openNamedChild(rowIndex) {
      if (!model) {
        return;
      }

      if (model.kind === 'single-object') {
        vscode.postMessage({ type: 'chooseChild', basePath: [...model.path] });
      } else {
        vscode.postMessage({ type: 'chooseChild', basePath: [...model.path, rowIndex] });
      }
    }

    function getMostCommonColumnValues(columnKey, currentRowIndex) {
      const counts = new Map();

      model.rows.forEach((row, idx) => {
        if (idx === currentRowIndex) return;
        const value = row[columnKey];
        if (typeof value !== 'string' || value.trim() === '') return;
        counts.set(value, (counts.get(value) || 0) + 1);
      });

      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 100)
        .map(([value]) => value);
    }

    function showPopupMenu(anchorEl, items, onPick) {
      if (activePopup) {
        activePopup.remove();
        activePopup = null;
      }

      if (!items || items.length === 0) {
        return;
      }

      const rect = anchorEl.getBoundingClientRect();
      const menu = document.createElement('div');
      menu.className = 'popupMenu';

      items.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'popupItem';
        btn.textContent = item;
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          onPick(item);
          if (activePopup) {
            activePopup.remove();
            activePopup = null;
          }
        });
        menu.appendChild(btn);
      });

      menu.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
      menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 280) + 'px';

      document.body.appendChild(menu);
      activePopup = menu;
    }

    function renderCell(row, rowIndex, column) {
      const wrap = document.createElement('div');
      wrap.className = 'cellWrap';
      const value = row[column.key];

      if (Array.isArray(value)) {
        const txt = document.createElement('input');
        txt.type = 'text';
        txt.value = JSON.stringify(value);
        txt.addEventListener('change', () => {
          row[column.key] = parseLoose(txt.value);
        });

        const openBtn = document.createElement('button');
        openBtn.textContent = 'Open child';

        let childPath;
        if (model.kind === 'single-object') {
          childPath = [...model.path, column.key];
        } else {
          childPath = [...model.path, rowIndex, column.key];
        }

        openBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'openChild', path: childPath });
        });

        wrap.appendChild(txt);
        wrap.appendChild(openBtn);
        return wrap;
      }

      if (value && typeof value === 'object') {
        const txt = document.createElement('input');
        txt.type = 'text';
        txt.value = JSON.stringify(value);
        txt.addEventListener('change', () => {
          row[column.key] = parseLoose(txt.value);
        });

        if (hasAnyChildArrays(value)) {
          const openBtn = document.createElement('button');
          openBtn.textContent = 'Open child';
          openBtn.addEventListener('click', () => {
            let basePath;
            if (model.kind === 'single-object') {
              basePath = [...model.path, column.key];
            } else {
              basePath = [...model.path, rowIndex, column.key];
            }
            vscode.postMessage({ type: 'chooseChild', basePath });
          });
          wrap.appendChild(txt);
          wrap.appendChild(openBtn);
          return wrap;
        }

        wrap.appendChild(txt);
        return wrap;
      }

      if (column.type === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value ?? '';
        input.addEventListener('change', () => {
          row[column.key] = input.value === '' ? null : Number(input.value);
        });
        wrap.appendChild(input);
        return wrap;
      }

      if (column.type === 'bool') {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.textContent = value === true ? 'true' : value === false ? 'false' : '(empty)';
        toggleBtn.addEventListener('click', () => {
          row[column.key] = value === true ? false : true;
          render(currentFileName, currentPathLabel, currentRootLabel);
        });
        wrap.appendChild(toggleBtn);
        return wrap;
      }

      if (column.type === 'color') {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = normalizeColor(value);
        input.addEventListener('change', () => {
          row[column.key] = input.value;
        });
        wrap.appendChild(input);
        return wrap;
      }

      const text = document.createElement('input');
      text.type = 'text';
      text.value = value ?? '';
      text.addEventListener('change', () => {
        row[column.key] = text.value;
      });
      wrap.appendChild(text);

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'menuBtn';
      menuBtn.textContent = '≡';
      menuBtn.title = 'Common values';
      menuBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const items = getMostCommonColumnValues(column.key, rowIndex);
        showPopupMenu(menuBtn, items, (picked) => {
          row[column.key] = picked;
          render(currentFileName, currentPathLabel, currentRootLabel);
        });
      });
      wrap.appendChild(menuBtn);

      return wrap;
    }

    function addRow() {
      if (!model || model.kind === 'single-object') return;

      if (model.kind === 'primitive-array') {
        const key = model.columns[0].key;
        const row = {};
        row[key] = defaultValueForType(model.columns[0].type);
        model.rows.push(row);
      } else {
        const row = {};
        model.columns.forEach((c) => row[c.key] = defaultValueForType(c.type));
        model.rows.push(row);
      }

      render(currentFileName, currentPathLabel, currentRootLabel);
    }

    function cloneRow(rowIndex) {
      if (!model || model.kind === 'single-object') return;
      const row = model.rows[rowIndex];
      model.rows.splice(rowIndex + 1, 0, JSON.parse(JSON.stringify(row)));
      render(currentFileName, currentPathLabel, currentRootLabel);
    }

    function deleteRow(rowIndex) {
      if (!model || model.kind === 'single-object') return;
      model.rows.splice(rowIndex, 1);
      render(currentFileName, currentPathLabel, currentRootLabel);
    }

    function addColumn() {
      if (!model || model.kind === 'primitive-array') {
        return;
      }

      const base = 'newColumn';
      let name = base;
      let i = 1;
      const existing = new Set(model.columns.map((c) => c.key));
      while (existing.has(name)) {
        name = base + i++;
      }

      model.columns.push({ key: name, type: 'text' });
      model.rows.forEach((row) => {
        row[name] = '';
      });
      render(currentFileName, currentPathLabel, currentRootLabel);
    }

    function removeColumn(colIndex) {
      if (!model || model.kind === 'primitive-array') {
        return;
      }

      const column = model.columns[colIndex];
      if (!column) {
        return;
      }

      const confirmed = window.confirm('Remove column "' + column.key + '"?');
      if (!confirmed) {
        return;
      }

      model.columns.splice(colIndex, 1);
      model.rows.forEach((row) => {
        delete row[column.key];
      });

      render(currentFileName, currentPathLabel, currentRootLabel);
    }

    function renameColumn(colIndex, nextName) {
      if (!model || model.kind === 'primitive-array') {
        return;
      }

      const trimmed = (nextName || '').trim();
      if (!trimmed) {
        render(currentFileName, currentPathLabel, currentRootLabel);
        return;
      }

      const duplicateIndex = model.columns.findIndex((c, i) => i !== colIndex && c.key === trimmed);
      if (duplicateIndex >= 0) {
        render(currentFileName, currentPathLabel, currentRootLabel);
        return;
      }

      const previous = model.columns[colIndex].key;
      if (previous === trimmed) {
        return;
      }

      model.columns[colIndex].key = trimmed;
      model.rows.forEach((row) => {
        row[trimmed] = row[previous];
        delete row[previous];
      });

      render(currentFileName, currentPathLabel, currentRootLabel);
    }

    function hasAnyChildArrays(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
      }
      return Object.keys(value).some((key) => Array.isArray(value[key]));
    }

    function defaultValueForType(type) {
      switch (type) {
        case 'number':
          return 0;
        case 'bool':
          return false;
        case 'color':
          return '#000000';
        default:
          return '';
      }
    }

    function normalizeColor(value) {
      if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
        return value;
      }
      return '#000000';
    }

    function parseLoose(value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  </script>
</body>
</html>`;
    }
}
function pathToLabel(path) {
    return path.length === 0
        ? '$'
        : '$.' + path.map((part) => (typeof part === 'number' ? `[${part}]` : part)).join('.').replace(/\.\[/g, '[');
}
function pathsEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return a.every((part, index) => part === b[index]);
}
function getLogicalParentPath(currentPath, rootPath) {
    if (pathsEqual(currentPath, rootPath)) {
        return [...rootPath];
    }
    const parentPath = [...currentPath];
    parentPath.pop();
    if (parentPath.length < rootPath.length) {
        return [...rootPath];
    }
    return parentPath;
}
function isEditableNode(node) {
    if (node.type === 'array') {
        return isSupportedArray(node);
    }
    if (node.type === 'object') {
        return isStandaloneObject(node) || node.parent?.type === 'array';
    }
    return false;
}
function findNearestEditableParentPath(root, currentPath, rootPath) {
    if (pathsEqual(currentPath, rootPath)) {
        return undefined;
    }
    for (let i = currentPath.length - 1; i >= rootPath.length; i--) {
        const candidate = currentPath.slice(0, i);
        const node = getNodeByPath(root, candidate);
        if (!node) {
            continue;
        }
        if (node.type === 'array' && isSupportedArray(node)) {
            return candidate;
        }
        if (node.type === 'object') {
            if (isStandaloneObject(node)) {
                return candidate;
            }
            if (node.parent?.type === 'array') {
                return getNodePath(node.parent);
            }
        }
    }
    return [...rootPath];
}
function getNodePath(node) {
    const parts = [];
    let current = node;
    while (current?.parent) {
        const parent = current.parent;
        if (parent.type === 'array') {
            const idx = parent.children?.findIndex((child) => child === current) ?? -1;
            if (idx >= 0) {
                parts.unshift(idx);
            }
        }
        else if (parent.type === 'property') {
            const keyNode = parent.children?.[0];
            const key = keyNode ? (0, jsonc_parser_1.getNodeValue)(keyNode) : undefined;
            if (typeof key === 'string') {
                parts.unshift(key);
            }
        }
        current = parent;
    }
    return parts;
}
function getNodeByPath(root, path) {
    let current = root;
    for (const part of path) {
        if (!current) {
            return undefined;
        }
        if (typeof part === 'number') {
            if (current.type !== 'array') {
                return undefined;
            }
            current = current.children?.[part];
        }
        else {
            if (current.type !== 'object') {
                return undefined;
            }
            const prop = current.children?.find((child) => {
                const keyNode = child.children?.[0];
                return keyNode && (0, jsonc_parser_1.getNodeValue)(keyNode) === part;
            });
            current = prop?.children?.[1];
        }
    }
    return current;
}
function findRelevantEditableNode(root, cursorOffset) {
    let node = (0, jsonc_parser_1.findNodeAtOffset)(root, cursorOffset, true);
    while (node) {
        if (node.type === 'array' && isSupportedArray(node)) {
            return node;
        }
        if (node.parent?.type === 'array' && isSupportedArray(node.parent)) {
            return node.parent;
        }
        node = node.parent;
    }
    node = (0, jsonc_parser_1.findNodeAtOffset)(root, cursorOffset, true);
    while (node) {
        if (node.type === 'object' && isStandaloneObject(node)) {
            return node;
        }
        node = node.parent;
    }
    return undefined;
}
function isStandaloneObject(node) {
    if (node.type !== 'object') {
        return false;
    }
    if (node.parent?.type === 'array') {
        return false;
    }
    return true;
}
function isSupportedArray(arrayNode) {
    if (arrayNode.type !== 'array') {
        return false;
    }
    const values = arrayNode.children ?? [];
    if (values.length === 0) {
        return true;
    }
    const allObjects = values.every((child) => child.type === 'object');
    if (allObjects) {
        return true;
    }
    const allPrimitives = values.every((child) => ['string', 'number', 'boolean', 'null'].includes(child.type));
    return allPrimitives;
}
function buildModelFromArrayNode(arrayNode, path) {
    const values = (arrayNode.children ?? []).map((child) => (0, jsonc_parser_1.getNodeValue)(child));
    const allObjects = values.every((value) => value && typeof value === 'object' && !Array.isArray(value));
    if (allObjects) {
        const rows = values;
        const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
        const columns = keys.map((key) => ({
            key,
            type: detectColumnType(rows.map((row) => row[key])),
        }));
        return {
            kind: 'object-array',
            columns,
            rows: rows.map((row) => ({ ...row })),
            path,
            rootPath: [...path],
        };
    }
    const primitiveValues = values;
    const columns = [{ key: 'value', type: detectColumnType(primitiveValues) }];
    return {
        kind: 'primitive-array',
        columns,
        rows: primitiveValues.map((value) => ({ value })),
        path,
        rootPath: [...path],
    };
}
function buildModelFromObjectNode(objectNode, path) {
    const value = (0, jsonc_parser_1.getNodeValue)(objectNode);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Object at cursor is not supported.');
    }
    const row = value;
    const keys = Object.keys(row);
    const columns = keys.map((key) => ({
        key,
        type: detectColumnType([row[key]]),
    }));
    return {
        kind: 'single-object',
        columns,
        rows: [{ ...row }],
        path,
        rootPath: [...path],
    };
}
function detectColumnType(values) {
    const nonNull = values.filter((value) => value !== null && value !== undefined);
    if (nonNull.length === 0) {
        return 'text';
    }
    if (nonNull.every((value) => typeof value === 'number')) {
        return 'number';
    }
    if (nonNull.every((value) => typeof value === 'boolean')) {
        return 'bool';
    }
    if (nonNull.every((value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))) {
        return 'color';
    }
    return 'text';
}
function materializeValue(model) {
    if (model.kind === 'primitive-array') {
        const key = model.columns[0]?.key ?? 'value';
        return model.rows.map((row) => coerceByType(row[key], model.columns[0]?.type ?? 'text'));
    }
    if (model.kind === 'single-object') {
        const row = model.rows[0] ?? {};
        const out = {};
        for (const column of model.columns) {
            out[column.key] = coerceByType(row[column.key], column.type);
        }
        return out;
    }
    return model.rows.map((row) => {
        const out = {};
        for (const column of model.columns) {
            out[column.key] = coerceByType(row[column.key], column.type);
        }
        return out;
    });
}
function coerceByType(value, type) {
    if (Array.isArray(value)) {
        return value;
    }
    if (value && typeof value === 'object') {
        return value;
    }
    if (value === null || value === undefined) {
        return null;
    }
    switch (type) {
        case 'number': {
            if (typeof value === 'number')
                return value;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        case 'bool': {
            if (typeof value === 'boolean')
                return value;
            if (typeof value === 'string') {
                if (value.toLowerCase() === 'true')
                    return true;
                if (value.toLowerCase() === 'false')
                    return false;
            }
            return Boolean(value);
        }
        case 'color':
            return typeof value === 'string' ? value : String(value);
        case 'text':
        default:
            return typeof value === 'string' ? value : JSON.stringify(value);
    }
}
function getNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let i = 0; i < 32; i++) {
        value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return value;
}
function deactivate() {
    // no-op
}
//# sourceMappingURL=extension.js.map