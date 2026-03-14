function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

export function getWebviewHtml() {
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
      position: relative;
    }
    .resizeHandle {
      position: absolute;
      top: 0;
      right: -3px;
      width: 8px;
      height: 100%;
      cursor: col-resize;
      user-select: none;
      z-index: 2;
    }
    .resizeHandle:hover {
      background: var(--vscode-focusBorder);
      opacity: 0.35;
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
    let searchTerm = '';
    let activePopup = null;

    const state = vscode.getState() || {};
    let columnWidths = state.columnWidths || {};

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
      render(currentFileName, currentPathLabel);
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'load') {
        model = msg.model;
        currentFileName = msg.fileName;
        currentPathLabel = msg.pathLabel;
        render(msg.fileName, msg.pathLabel);
        return;
      }

      if (msg.type === 'removeColumnResult') {
        if (msg.confirmed) {
          removeColumn(msg.colIndex, false);
        }
      }
    });

    function render(fileName, pathLabel) {
      if (!model) {
        tableHost.innerHTML = '<p>No model loaded.</p>';
        return;
      }

      meta.textContent = fileName + '  •  ' + pathLabel;
      goParentBtn.disabled = !model || model.path.length === 0;
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

        const widthKey = getColumnWidthKey(colIndex, column.key);
        const savedWidth = columnWidths[widthKey];
        if (typeof savedWidth === 'number' && savedWidth > 40) {
          th.style.width = savedWidth + 'px';
        }

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
          requestRemoveColumn(colIndex);
        });

        const typeSelect = document.createElement('select');
        ['text', 'number', 'bool', 'color', 'array', 'object'].forEach((t) => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          if (column.type === t) opt.selected = true;
          typeSelect.appendChild(opt);
        });
        typeSelect.addEventListener('input', () => {
          changeColumnType(colIndex, typeSelect.value);
        });

        nameRow.appendChild(nameInput);
        nameRow.appendChild(removeBtn);
        wrap.appendChild(nameRow);
        wrap.appendChild(typeSelect);
        th.appendChild(wrap);

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resizeHandle';
        resizeHandle.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          startColumnResize(event, th, colIndex, column.key);
        });
        th.appendChild(resizeHandle);

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

    function getColumnWidthKey(colIndex, columnKey) {
      return currentPathLabel + '::' + colIndex + '::' + columnKey;
    }

    function startColumnResize(event, th, colIndex, columnKey) {
      const startX = event.clientX;
      const startWidth = th.getBoundingClientRect().width;
      const widthKey = getColumnWidthKey(colIndex, columnKey);

      function onMouseMove(moveEvent) {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(80, Math.round(startWidth + delta));
        th.style.width = nextWidth + 'px';
        columnWidths[widthKey] = nextWidth;
        vscode.setState({ columnWidths });
      }

      function onMouseUp() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    function getChildPath(rowIndex, columnKey) {
      if (model.kind === 'single-object') {
        return [...model.path, columnKey];
      }
      return [...model.path, rowIndex, columnKey];
    }

    function createStructuredValue(row, rowIndex, column) {
      const path = getChildPath(rowIndex, column.key);

      if (column.type === 'array') {
        row[column.key] = [];
        render(currentFileName, currentPathLabel);
        vscode.postMessage({ type: 'openChild', path });
        return;
      }

      if (column.type === 'object') {
        row[column.key] = {};
        render(currentFileName, currentPathLabel);
        vscode.postMessage({ type: 'openChild', path });
      }
    }

    function renderCell(row, rowIndex, column) {
      const wrap = document.createElement('div');
      wrap.className = 'cellWrap';
      const value = row[column.key];

      if (column.type === 'array' && (value === null || value === undefined || !Array.isArray(value))) {
        const createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.textContent = 'Create';
        createBtn.addEventListener('click', () => {
          createStructuredValue(row, rowIndex, column);
        });
        wrap.appendChild(createBtn);
        return wrap;
      }

      if (
        column.type === 'object' &&
        (value === null || value === undefined || Array.isArray(value) || typeof value !== 'object')
      ) {
        const createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.textContent = 'Create';
        createBtn.addEventListener('click', () => {
          createStructuredValue(row, rowIndex, column);
        });
        wrap.appendChild(createBtn);
        return wrap;
      }

      if (Array.isArray(value)) {
        const txt = document.createElement('input');
        txt.type = 'text';
        txt.value = JSON.stringify(value);
        txt.addEventListener('change', () => {
          row[column.key] = parseLoose(txt.value);
        });

        const openBtn = document.createElement('button');
        openBtn.textContent = 'Open child';

        const childPath = getChildPath(rowIndex, column.key);

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
            const basePath = getChildPath(rowIndex, column.key);
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
          const current = row[column.key];
          row[column.key] = current === true ? false : true;
          render(currentFileName, currentPathLabel);
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
          render(currentFileName, currentPathLabel);
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

      render(currentFileName, currentPathLabel);
    }

    function cloneRow(rowIndex) {
      if (!model || model.kind === 'single-object') return;
      const row = model.rows[rowIndex];
      model.rows.splice(rowIndex + 1, 0, JSON.parse(JSON.stringify(row)));
      render(currentFileName, currentPathLabel);
    }

    function deleteRow(rowIndex) {
      if (!model || model.kind === 'single-object') return;
      model.rows.splice(rowIndex, 1);
      render(currentFileName, currentPathLabel);
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
      render(currentFileName, currentPathLabel);
    }

    function requestRemoveColumn(colIndex) {
      if (!model || model.kind === 'primitive-array') {
        return;
      }

      const column = model.columns[colIndex];
      if (!column) {
        return;
      }

      vscode.postMessage({
        type: 'confirmRemoveColumn',
        colIndex,
        columnKey: column.key,
      });
    }

    function removeColumn(colIndex, askConfirmation = true) {
      if (!model || model.kind === 'primitive-array') {
        return;
      }

      const column = model.columns[colIndex];
      if (!column) {
        return;
      }

      if (askConfirmation) {
        requestRemoveColumn(colIndex);
        return;
      }

      model.columns.splice(colIndex, 1);
      model.rows.forEach((row) => {
        delete row[column.key];
      });

      render(currentFileName, currentPathLabel);
    }

    function renameColumn(colIndex, nextName) {
      if (!model || model.kind === 'primitive-array') {
        return;
      }

      const trimmed = (nextName || '').trim();
      if (!trimmed) {
        render(currentFileName, currentPathLabel);
        return;
      }

      const duplicateIndex = model.columns.findIndex((c, i) => i !== colIndex && c.key === trimmed);
      if (duplicateIndex >= 0) {
        render(currentFileName, currentPathLabel);
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

      render(currentFileName, currentPathLabel);
    }

    function changeColumnType(colIndex, nextType) {
      if (!model) {
        return;
      }

      const column = model.columns[colIndex];
      if (!column) {
        return;
      }

      column.type = nextType;

      for (const row of model.rows) {
        row[column.key] = convertValueForType(row[column.key], nextType);
      }

      render(currentFileName, currentPathLabel);
    }

    function convertValueForType(value, type) {
      if (type === 'array') {
        return Array.isArray(value) ? value : null;
      }

      if (type === 'object') {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      }

      if (Array.isArray(value) || (value && typeof value === 'object')) {
        return value;
      }

      if (value === null || value === undefined) {
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

      switch (type) {
        case 'number': {
          if (typeof value === 'number') {
            return value;
          }
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }

        case 'bool': {
          if (typeof value === 'boolean') {
            return value;
          }
          if (typeof value === 'string') {
            const lower = value.trim().toLowerCase();
            if (lower === 'true') return true;
            if (lower === 'false') return false;
            if (lower === '1') return true;
            if (lower === '0') return false;
          }
          return Boolean(value);
        }

        case 'color': {
          if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
            return value;
          }
          return '#000000';
        }

        case 'text':
        default:
          return typeof value === 'string' ? value : String(value);
      }
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
        case 'array':
        case 'object':
          return null;
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