import * as vscode from 'vscode';
import { JsonArrayEditorPanel } from './panel';

type OpenPayload = {
  documentUri: string;
  cursorOffset?: number;
  nestedPath?: Array<string | number>;
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('jsonArrayEditor.editAtCursor', async (payload?: OpenPayload) => {
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
    })
  );
}

export function deactivate() {
  // no-op
}