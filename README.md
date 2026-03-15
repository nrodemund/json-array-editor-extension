# JsonArrayEditor

A VS Code extension that opens a spreadsheet-like editor for JSON arrays by right-clicking an json array.

![Screenshot](images/screenshot1.png)



## Features

- Adds **Edit with JsonArrayEditor** to the editor context menu for JSON and JSONC files.
- Opens the array at the current cursor position.
- Supports:
  - arrays of objects (`[{...}, {...}]`)
  - native arrays of primitive values (`[1, 2, 3]`, `["a", "b"]`, `[true, false]`)
- Shows unioned object keys as spreadsheet columns.
- Add row, clone row, add column, rename column.
- Per-column type selection: `text`, `number`, `bool`, `color`.
- Nested arrays are shown as text with an **Open child** action.


Then press `F5` in VS Code to launch an Extension Development Host.
