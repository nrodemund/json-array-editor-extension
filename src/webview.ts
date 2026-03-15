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
    .paginationBar {
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
    button, textarea {
      font: inherit;
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
      min-width: 0;
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
      max-width: 360px;
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
    .popupDesc {
      display: block;
      font-size: 0.9em;
      opacity: 0.75;
      margin-top: 2px;
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
    .indexCol {
      width: 140px;
      min-width: 140px;
    }
    .indexCell {
      display: flex;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }
    .rowKeyInput {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }
    .dragHandle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      cursor: grab;
      user-select: none;
    }
    .dragHandle:active {
      cursor: grabbing;
    }
    .rowDropBefore td {
      box-shadow: inset 0 2px 0 var(--vscode-focusBorder);
    }
    .rowDropAfter td {
      box-shadow: inset 0 -2px 0 var(--vscode-focusBorder);
    }
    .longTextBtn {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: left;
      display: block;
    }
    .modalBackdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 16px;
    }
    .modalCard {
      width: min(900px, 100%);
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
      border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      overflow: hidden;
    }
    .modalHeader {
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-weight: 600;
    }
    .modalBody {
      padding: 12px;
      min-height: 240px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .modalTextarea {
      width: 100%;
      min-height: 320px;
      resize: vertical;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
      padding: 8px;
      font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
      font-size: var(--vscode-font-size);
    }
    .modalFooter {
      padding: 10px 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      justify-content: flex-end;
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
  <div id="paginationHost"></div>
  <div id="tableHost"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let model = null;
    let sessionRootValue = null;
    let sessionRootPath = [];
    let currentFileName = '';
    let currentPathLabel = '';
    let searchTerm = '';
    let activePopup = null;
    let draggedRowIndex = null;
    let activeModal = null;
    let currentPage = 1;
    const pageSize = 25;

    const state = vscode.getState() || {};
    let columnWidths = state.columnWidths || {};

    const meta = document.getElementById('meta');
    const kindLabel = document.getElementById('kindLabel');
    const tableHost = document.getElementById('tableHost');
    const paginationHost = document.getElementById('paginationHost');
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
      if (!model) {
        return;
      }
      const rootModel = buildModelFromValue(sessionRootValue, sessionRootPath);
      vscode.postMessage({ type: 'save', model: rootModel });
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    goParentBtn.addEventListener('click', () => {
      goToParentVirtual();
    });

    addRowBtn.addEventListener('click', () => addRow());

    document.getElementById('addColumnBtn').addEventListener('click', () => addColumn());

    searchInput.addEventListener('input', () => {
      searchTerm = (searchInput.value || '').toLowerCase();
      currentPage = 1;
      render(currentFileName, currentPathLabel);
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'load') {
        model = deepClone(msg.model);
        sessionRootPath = [...msg.model.path];
        sessionRootValue = materializeModelValue(msg.model);
        currentFileName = msg.fileName;
        currentPathLabel = msg.pathLabel;
        currentPage = 1;
        render(msg.fileName, msg.pathLabel);
        return;
      }

      if (msg.type === 'removeColumnResult') {
        if (msg.confirmed) {
          removeColumn(msg.colIndex, false);
        }
      }
    });

    function deepClone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function pathToLabel(path) {
      return path.length === 0
        ? '$'
        : '$.' + path.map((part) => (typeof part === 'number' ? '[' + part + ']' : part)).join('.').replace(/\\.\\[/g, '[');
    }

    function isSupportedArrayValue(value) {
      if (!Array.isArray(value)) {
        return false;
      }
      if (value.length === 0) {
        return true;
      }
      const allObjects = value.every((item) => item && typeof item === 'object' && !Array.isArray(item));
      if (allObjects) {
        return true;
      }
      return value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item));
    }

    function detectColumnType(values) {
      const nonNull = values.filter((value) => value !== null && value !== undefined);
      if (nonNull.length === 0) return 'text';
      if (nonNull.every((value) => Array.isArray(value))) return 'array';
      if (nonNull.every((value) => value && typeof value === 'object' && !Array.isArray(value))) return 'object';
      if (nonNull.every((value) => typeof value === 'number')) return 'number';
      if (nonNull.every((value) => typeof value === 'boolean')) return 'bool';
      if (nonNull.every((value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))) return 'color';

      const firstFive = values.slice(0, 5).filter((value) => typeof value === 'string');
      if (firstFive.some((value) => value.length > 100)) return 'longtext';

      return 'text';
    }

    function buildModelFromValue(value, path) {
      if (Array.isArray(value)) {
        const allObjects = value.every((item) => item && typeof item === 'object' && !Array.isArray(item));
        if (allObjects) {
          const rows = value.map((item) => ({ ...item }));
          const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
          return {
            kind: 'object-array',
            columns: keys.map((key) => ({
              key,
              type: detectColumnType(rows.map((row) => row[key])),
            })),
            rows,
            path: [...path],
            rootPath: [...sessionRootPath],
          };
        }

        return {
          kind: 'primitive-array',
          columns: [{ key: 'value', type: detectColumnType(value) }],
          rows: value.map((item) => ({ value: item })),
          path: [...path],
          rootPath: [...sessionRootPath],
        };
      }

      if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        const isObjectMap =
          keys.length > 0 &&
          keys.every((key) => {
            const item = value[key];
            return item && typeof item === 'object' && !Array.isArray(item);
          });

        if (isObjectMap) {
          const rowKeys = [...keys];
          const rows = rowKeys.map((key) => ({ ...value[key] }));
          const columnKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
          return {
            kind: 'object-map',
            columns: columnKeys.map((key) => ({
              key,
              type: detectColumnType(rows.map((row) => row[key])),
            })),
            rows,
            rowKeys,
            path: [...path],
            rootPath: [...sessionRootPath],
          };
        }

        return {
          kind: 'single-object',
          columns: keys.map((key) => ({
            key,
            type: detectColumnType([value[key]]),
          })),
          rows: [{ ...value }],
          path: [...path],
          rootPath: [...sessionRootPath],
        };
      }

      return null;
    }

    function materializeModelValue(currentModel) {
      if (currentModel.kind === 'primitive-array') {
        const key = currentModel.columns[0]?.key ?? 'value';
        return currentModel.rows.map((row) => row[key]);
      }

      if (currentModel.kind === 'single-object') {
        const row = currentModel.rows[0] ?? {};
        const out = {};
        for (const column of currentModel.columns) {
          out[column.key] = row[column.key];
        }
        return out;
      }

      if (currentModel.kind === 'object-map') {
        const out = {};
        const rowKeys = currentModel.rowKeys || [];
        for (let i = 0; i < currentModel.rows.length; i++) {
          const key = rowKeys[i];
          if (!key) continue;
          const row = currentModel.rows[i] ?? {};
          const rowOut = {};
          for (const column of currentModel.columns) {
            rowOut[column.key] = row[column.key];
          }
          out[key] = rowOut;
        }
        return out;
      }

      return currentModel.rows.map((row) => {
        const out = {};
        for (const column of currentModel.columns) {
          out[column.key] = row[column.key];
        }
        return out;
      });
    }

    function relativePathFromRoot(path) {
      return path.slice(sessionRootPath.length);
    }

    function getValueAtRelativePath(rootValue, relativePath) {
      let current = rootValue;
      for (const part of relativePath) {
        if (current == null) {
          return undefined;
        }
        current = current[part];
      }
      return current;
    }

    function setValueAtRelativePath(rootValue, relativePath, value) {
      if (relativePath.length === 0) {
        sessionRootValue = value;
        return;
      }

      let current = rootValue;
      for (let i = 0; i < relativePath.length - 1; i++) {
        current = current[relativePath[i]];
      }
      current[relativePath[relativePath.length - 1]] = value;
    }

    function syncCurrentModelToRoot() {
      if (!model) {
        return;
      }
      const currentValue = materializeModelValue(model);
      setValueAtRelativePath(sessionRootValue, relativePathFromRoot(model.path), currentValue);
    }

    function openVirtualChild(path) {
      const childValue = getValueAtRelativePath(sessionRootValue, relativePathFromRoot(path));
      const childModel = buildModelFromValue(childValue, path);
      if (!childModel) {
        return;
      }
      model = childModel;
      currentPathLabel = pathToLabel(path);
      currentPage = 1;
      render(currentFileName, currentPathLabel);
    }

    function findNearestEditableParentPathVirtual(path) {
      if (path.length === sessionRootPath.length) {
        return null;
      }

      for (let i = path.length - 1; i >= sessionRootPath.length; i--) {
        const candidate = path.slice(0, i);
        const candidateValue = getValueAtRelativePath(sessionRootValue, relativePathFromRoot(candidate));
        if (Array.isArray(candidateValue) && isSupportedArrayValue(candidateValue)) {
          return candidate;
        }
        if (candidateValue && typeof candidateValue === 'object') {
          return candidate;
        }
      }

      return null;
    }

    function goToParentVirtual() {
      if (!model || model.path.length === sessionRootPath.length) {
        vscode.postMessage({ type: 'goParent' });
        return;
      }

      const parentPath = findNearestEditableParentPathVirtual(model.path);
      if (!parentPath) {
        vscode.postMessage({ type: 'goParent' });
        return;
      }

      openVirtualChild(parentPath);
    }

    function getChildArrayPicksFromValue(baseValue, basePath) {
      const picks = [];

      if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
        for (const key of Object.keys(baseValue)) {
          const childValue = baseValue[key];
          if (Array.isArray(childValue) && isSupportedArrayValue(childValue)) {
            picks.push({
              label: key,
              description: pathToLabel([...basePath, key]),
              path: [...basePath, key],
            });
          }
        }
      } else if (Array.isArray(baseValue)) {
        for (let i = 0; i < baseValue.length; i++) {
          const item = baseValue[i];
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            for (const key of Object.keys(item)) {
              const childValue = item[key];
              if (Array.isArray(childValue) && isSupportedArrayValue(childValue)) {
                picks.push({
                  label: key + ' (row ' + (i + 1) + ')',
                  description: pathToLabel([...basePath, i, key]),
                  path: [...basePath, i, key],
                });
              }
            }
          }
        }
      }

      return picks;
    }

    function showChoiceMenu(anchorEl, items, onPick) {
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
        btn.innerHTML = item.label + (item.description ? '<span class="popupDesc">' + escapeHtml(item.description) + '</span>' : '');
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

      menu.style.left = Math.min(rect.left, window.innerWidth - 380) + 'px';
      menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 280) + 'px';

      document.body.appendChild(menu);
      activePopup = menu;
    }

    function escapeHtml(text) {
      return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function getVisibleRows() {
      if (!model) {
        return [];
      }

      const visible = [];
      for (let i = 0; i < model.rows.length; i++) {
        const row = model.rows[i];
        if (rowMatchesSearch(row, i)) {
          visible.push({ row, rowIndex: i });
        }
      }
      return visible;
    }

    function getPagedRows(visibleRows) {
      const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      return {
        totalPages,
        start,
        end,
        rows: visibleRows.slice(start, end),
      };
    }

    function renderPagination(visibleRows) {
      paginationHost.innerHTML = '';

      if (visibleRows.length <= pageSize) {
        return;
      }

      const { totalPages, start, end } = getPagedRows(visibleRows);

      const bar = document.createElement('div');
      bar.className = 'paginationBar';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.textContent = 'Previous';
      prevBtn.disabled = currentPage <= 1;
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage -= 1;
          render(currentFileName, currentPathLabel);
        }
      });

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.textContent = 'Next';
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage += 1;
          render(currentFileName, currentPathLabel);
        }
      });

      const label = document.createElement('span');
      label.className = 'small';
      label.textContent = 'Rows ' + (start + 1) + '-' + Math.min(end, visibleRows.length) + ' of ' + visibleRows.length + ' • Page ' + currentPage + ' / ' + totalPages;

      bar.appendChild(prevBtn);
      bar.appendChild(nextBtn);
      bar.appendChild(label);
      paginationHost.appendChild(bar);
    }

    function render(fileName, pathLabel) {
      if (!model) {
        tableHost.innerHTML = '<p>No model loaded.</p>';
        paginationHost.innerHTML = '';
        return;
      }

      meta.textContent = fileName + '  •  ' + pathLabel;
      goParentBtn.disabled = !model || model.path.length === 0;
      addRowBtn.style.display = model.kind === 'single-object' ? 'none' : '';

      if (model.kind === 'object-array') {
        kindLabel.textContent = 'Object array';
      } else if (model.kind === 'primitive-array') {
        kindLabel.textContent = 'Primitive array';
      } else if (model.kind === 'object-map') {
        kindLabel.textContent = 'Object map';
      } else {
        kindLabel.textContent = 'Single object';
      }

      if (activePopup) {
        activePopup.remove();
        activePopup = null;
      }

      const visibleRows = getVisibleRows();
      renderPagination(visibleRows);
      const paged = getPagedRows(visibleRows);

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const hRow = document.createElement('tr');

      const indexTh = document.createElement('th');
      indexTh.className = 'indexCol';
      indexTh.textContent = model.kind === 'object-map' ? 'Key' : 'Index';
      hRow.appendChild(indexTh);

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
        ['text', 'longtext', 'number', 'bool', 'color', 'array', 'object'].forEach((t) => {
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

      paged.rows.forEach(({ row, rowIndex }) => {
        const tr = document.createElement('tr');

        tr.addEventListener('dragover', (event) => {
          if (model.kind !== 'object-array' && model.kind !== 'primitive-array') {
            return;
          }
          if (draggedRowIndex === null || draggedRowIndex === rowIndex) {
            return;
          }
          event.preventDefault();
          const rect = tr.getBoundingClientRect();
          const before = event.clientY < rect.top + rect.height / 2;
          tr.classList.toggle('rowDropBefore', before);
          tr.classList.toggle('rowDropAfter', !before);
        });

        tr.addEventListener('dragleave', () => {
          tr.classList.remove('rowDropBefore', 'rowDropAfter');
        });

        tr.addEventListener('drop', (event) => {
          if (model.kind !== 'object-array' && model.kind !== 'primitive-array') {
            return;
          }
          if (draggedRowIndex === null || draggedRowIndex === rowIndex) {
            return;
          }

          event.preventDefault();
          const rect = tr.getBoundingClientRect();
          const before = event.clientY < rect.top + rect.height / 2;
          moveRow(draggedRowIndex, before ? rowIndex : rowIndex + 1);
          draggedRowIndex = null;
          tr.classList.remove('rowDropBefore', 'rowDropAfter');
        });

        const indexTd = document.createElement('td');
        indexTd.className = 'indexCol';
        indexTd.appendChild(renderIndexCell(rowIndex));
        tr.appendChild(indexTd);

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
          openNamedChildBtn.addEventListener('click', () => {
            openNamedChild(rowIndex, openNamedChildBtn);
          });
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

    function renderIndexCell(rowIndex) {
      const wrap = document.createElement('div');
      wrap.className = 'indexCell';

      if (model.kind === 'object-map') {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rowKeyInput';
        input.value = getRowKey(rowIndex) || '';
        input.title = 'Row key';
        input.addEventListener('change', () => renameRowKey(rowIndex, input.value));
        wrap.appendChild(input);
        return wrap;
      }

      if (model.kind === 'object-array' || model.kind === 'primitive-array') {
        const dragHandle = document.createElement('button');
        dragHandle.type = 'button';
        dragHandle.className = 'dragHandle';
        dragHandle.draggable = true;
        dragHandle.textContent = '⋮⋮';
        dragHandle.title = 'Drag to reorder row';
        dragHandle.addEventListener('dragstart', (event) => {
          draggedRowIndex = rowIndex;
          try {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(rowIndex));
          } catch {}
        });
        dragHandle.addEventListener('dragend', () => {
          draggedRowIndex = null;
          clearDropIndicators();
        });

        const label = document.createElement('span');
        label.textContent = String(rowIndex);

        wrap.appendChild(dragHandle);
        wrap.appendChild(label);
        return wrap;
      }

      const label = document.createElement('span');
      label.textContent = '0';
      wrap.appendChild(label);
      return wrap;
    }

    function clearDropIndicators() {
      tableHost.querySelectorAll('.rowDropBefore, .rowDropAfter').forEach((el) => {
        el.classList.remove('rowDropBefore', 'rowDropAfter');
      });
    }

    function rowMatchesSearch(row, rowIndex) {
      if (!searchTerm) {
        return true;
      }

      const haystack = [];

      if (model.kind === 'object-map') {
        haystack.push(getRowKey(rowIndex) || '');
      } else {
        haystack.push(String(rowIndex));
      }

      for (const column of model.columns) {
        haystack.push(column.key);
        haystack.push(stringifyForSearch(row[column.key]));
      }

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

    function openNamedChild(rowIndex, anchorEl) {
      if (!model) {
        return;
      }

      if (model.kind === 'single-object') {
        const picks = getChildArrayPicksFromValue(sessionRootValue, model.path);
        if (picks.length === 0) {
          return;
        }
        if (picks.length === 1) {
          openVirtualChild(picks[0].path);
          return;
        }
        showChoiceMenu(anchorEl, picks, (pick) => openVirtualChild(pick.path));
        return;
      }

      const rowPath = getRowPath(rowIndex);
      const rowValue = getValueAtRelativePath(sessionRootValue, relativePathFromRoot(rowPath));
      const picks = getChildArrayPicksFromValue(rowValue, rowPath);
      if (picks.length === 0) {
        return;
      }
      if (picks.length === 1) {
        openVirtualChild(picks[0].path);
        return;
      }
      showChoiceMenu(anchorEl, picks, (pick) => openVirtualChild(pick.path));
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

    function getRowKey(rowIndex) {
      return model.kind === 'object-map' ? model.rowKeys?.[rowIndex] : undefined;
    }

    function getRowPath(rowIndex) {
      if (model.kind === 'single-object') {
        return [...model.path];
      }
      if (model.kind === 'object-map') {
        const rowKey = getRowKey(rowIndex);
        return rowKey ? [...model.path, rowKey] : [...model.path];
      }
      return [...model.path, rowIndex];
    }

    function getChildPath(rowIndex, columnKey) {
      return [...getRowPath(rowIndex), columnKey];
    }

    function getUniqueRowKey(base = 'key') {
      const existing = new Set(model.rowKeys || []);
      let candidate = base;
      let counter = 1;
      while (!candidate || existing.has(candidate)) {
        candidate = base + counter++;
      }
      return candidate;
    }

    function renameRowKey(rowIndex, nextKey) {
      if (!model || model.kind !== 'object-map') {
        return;
      }

      const trimmed = (nextKey || '').trim();
      if (!trimmed) {
        render(currentFileName, currentPathLabel);
        return;
      }

      const duplicateIndex = (model.rowKeys || []).findIndex((key, i) => i !== rowIndex && key === trimmed);
      if (duplicateIndex >= 0) {
        render(currentFileName, currentPathLabel);
        return;
      }

      model.rowKeys[rowIndex] = trimmed;
      syncCurrentModelToRoot();
      render(currentFileName, currentPathLabel);
    }

    function moveRow(fromIndex, toIndex) {
      if (!model || model.kind === 'single-object' || model.kind === 'object-map') {
        return;
      }

      const maxIndex = model.rows.length;
      let targetIndex = Math.max(0, Math.min(toIndex, maxIndex));
      if (fromIndex < targetIndex) {
        targetIndex -= 1;
      }
      if (fromIndex === targetIndex) {
        render(currentFileName, currentPathLabel);
        return;
      }

      const [row] = model.rows.splice(fromIndex, 1);
      model.rows.splice(targetIndex, 0, row);
      syncCurrentModelToRoot();
      render(currentFileName, currentPathLabel);
    }

    function createStructuredValue(row, rowIndex, column) {
      const path = getChildPath(rowIndex, column.key);

      if (column.type === 'array') {
        row[column.key] = [];
        syncCurrentModelToRoot();
        render(currentFileName, currentPathLabel);
        openVirtualChild(path);
        return;
      }

      if (column.type === 'object') {
        row[column.key] = {};
        syncCurrentModelToRoot();
        render(currentFileName, currentPathLabel);
        openVirtualChild(path);
      }
    }

    function truncateLongText(value) {
      const text = value == null ? '' : String(value).replace(/\\s+/g, ' ').trim();
      return text || '(empty)';
    }

    function showLongTextModal(row, column) {
      closeLongTextModal();

      const backdrop = document.createElement('div');
      backdrop.className = 'modalBackdrop';

      const card = document.createElement('div');
      card.className = 'modalCard';

      const header = document.createElement('div');
      header.className = 'modalHeader';
      header.textContent = 'Edit long text: ' + column.key;

      const body = document.createElement('div');
      body.className = 'modalBody';

      const textarea = document.createElement('textarea');
      textarea.className = 'modalTextarea';
      textarea.value = row[column.key] == null ? '' : String(row[column.key]);

      const footer = document.createElement('div');
      footer.className = 'modalFooter';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        closeLongTextModal();
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'Apply';
      saveBtn.addEventListener('click', () => {
        row[column.key] = textarea.value;
        syncCurrentModelToRoot();
        closeLongTextModal();
        render(currentFileName, currentPathLabel);
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      body.appendChild(textarea);
      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);
      backdrop.appendChild(card);

      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) {
          closeLongTextModal();
        }
      });

      function onKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeLongTextModal();
        }
      }

      activeModal = { backdrop, onKeyDown };
      document.body.appendChild(backdrop);
      window.addEventListener('keydown', onKeyDown);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    function closeLongTextModal() {
      if (!activeModal) {
        return;
      }
      window.removeEventListener('keydown', activeModal.onKeyDown);
      activeModal.backdrop.remove();
      activeModal = null;
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
          syncCurrentModelToRoot();
        });

        const openBtn = document.createElement('button');
        openBtn.textContent = 'Open child';

        const childPath = getChildPath(rowIndex, column.key);

        openBtn.addEventListener('click', () => {
          openVirtualChild(childPath);
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
          syncCurrentModelToRoot();
        });

        if (hasAnyChildArrays(value)) {
          const openBtn = document.createElement('button');
          openBtn.textContent = 'Open child';
          openBtn.addEventListener('click', () => {
            const basePath = getChildPath(rowIndex, column.key);
            const baseValue = getValueAtRelativePath(sessionRootValue, relativePathFromRoot(basePath));
            const picks = getChildArrayPicksFromValue(baseValue, basePath);
            if (picks.length === 0) {
              return;
            }
            if (picks.length === 1) {
              openVirtualChild(picks[0].path);
              return;
            }
            showChoiceMenu(openBtn, picks, (pick) => openVirtualChild(pick.path));
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
          syncCurrentModelToRoot();
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
          syncCurrentModelToRoot();
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
          syncCurrentModelToRoot();
        });
        wrap.appendChild(input);
        return wrap;
      }

      if (column.type === 'longtext') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'longTextBtn';
        btn.title = value == null ? '' : String(value);
        btn.textContent = truncateLongText(value);
        btn.addEventListener('click', () => {
          showLongTextModal(row, column);
        });
        wrap.appendChild(btn);
        return wrap;
      }

      const text = document.createElement('input');
      text.type = 'text';
      text.value = value ?? '';
      text.addEventListener('change', () => {
        row[column.key] = text.value;
        syncCurrentModelToRoot();
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
          syncCurrentModelToRoot();
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

        if (model.kind === 'object-map') {
          if (!model.rowKeys) {
            model.rowKeys = [];
          }
          model.rowKeys.push(getUniqueRowKey('key'));
        }
      }

      syncCurrentModelToRoot();
      currentPage = Math.max(1, Math.ceil(getVisibleRows().length / pageSize));
      render(currentFileName, currentPathLabel);
    }

    function cloneRow(rowIndex) {
      if (!model || model.kind === 'single-object') return;
      const row = model.rows[rowIndex];
      model.rows.splice(rowIndex + 1, 0, JSON.parse(JSON.stringify(row)));

      if (model.kind === 'object-map') {
        if (!model.rowKeys) {
          model.rowKeys = [];
        }
        const original = model.rowKeys[rowIndex] || 'key';
        model.rowKeys.splice(rowIndex + 1, 0, getUniqueRowKey(original));
      }

      syncCurrentModelToRoot();
      render(currentFileName, currentPathLabel);
    }

    function deleteRow(rowIndex) {
      if (!model || model.kind === 'single-object') return;
      model.rows.splice(rowIndex, 1);

      if (model.kind === 'object-map' && model.rowKeys) {
        model.rowKeys.splice(rowIndex, 1);
      }

      syncCurrentModelToRoot();
      const visibleRows = getVisibleRows();
      const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
      currentPage = Math.min(currentPage, totalPages);
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

      syncCurrentModelToRoot();
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

      syncCurrentModelToRoot();
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

      syncCurrentModelToRoot();
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

      syncCurrentModelToRoot();
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

        case 'longtext':
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
        case 'longtext':
        case 'text':
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