import * as vscode from 'vscode';
import { applyEdits, modify, parseTree, getNodeValue } from 'jsonc-parser';
import {
  type TableModel,
  buildModelFromArrayNode,
  buildModelFromObjectNode,
  findNearestEditableParentPath,
  findRelevantEditableNode,
  getNodeByPath,
  getNodePath,
  isSupportedArray,
  materializeValue,
  pathToLabel,
} from './jsonModel';
import { getWebviewHtml } from './webview';

export type OpenPayload = {
  documentUri: string;
  cursorOffset?: number;
  nestedPath?: Array<string | number>;
};

export class JsonArrayEditorPanel {
  public static currentPanel: JsonArrayEditorPanel | undefined;

  public static async createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    cursorOffset: number,
    nestedPath?: Array<string | number>
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (JsonArrayEditorPanel.currentPanel) {
      JsonArrayEditorPanel.currentPanel.panel.reveal(column);
      await JsonArrayEditorPanel.currentPanel.load(document, cursorOffset, nestedPath);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'jsonArrayEditor',
      'JsonArrayEditor',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    JsonArrayEditorPanel.currentPanel = new JsonArrayEditorPanel(panel, extensionUri);
    await JsonArrayEditorPanel.currentPanel.load(document, cursorOffset, nestedPath);
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly disposables: Array<vscode.Disposable> = [];
  private activeDocument?: vscode.TextDocument;
  private activePath: Array<string | number> = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panel.webview.html = getWebviewHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.type) {
            case 'save':
              await this.saveModel(message.model as TableModel);
              break;

            case 'openChild':
              if (!this.activeDocument) {
                return;
              }
              await this.load(this.activeDocument, 0, message.path as Array<string | number>);
              break;

            case 'chooseChild':
              if (!this.activeDocument) {
                return;
              }
              await this.chooseChildPath(message.basePath as Array<string | number>);
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

            case 'confirmRemoveColumn':
              await this.confirmRemoveColumn(message.colIndex as number, message.columnKey as string);
              break;
          }
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`JsonArrayEditor: ${text}`);
        }
      },
      null,
      this.disposables
    );
  }

  public dispose() {
    JsonArrayEditorPanel.currentPanel = undefined;
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  public async load(document: vscode.TextDocument, cursorOffset: number, nestedPath?: Array<string | number>) {
    this.activeDocument = document;
    const text = document.getText();
    const root = parseTree(text);
    if (!root) {
      throw new Error('Could not parse JSON document.');
    }

    const targetNode = nestedPath ? getNodeByPath(root, nestedPath) : findRelevantEditableNode(root, cursorOffset);
    if (!targetNode) {
      throw new Error('Cursor is not within a supported JSON array or standalone object.');
    }

    let model: TableModel;

    if (targetNode.type === 'array') {
      const path = getNodePath(targetNode);
      model = buildModelFromArrayNode(targetNode, path);
      this.activePath = path;
    } else if (targetNode.type === 'object') {
      const path = getNodePath(targetNode);
      model = buildModelFromObjectNode(targetNode, path);
      this.activePath = path;
    } else {
      throw new Error('Cursor is not within a supported JSON array or standalone object.');
    }

    model.rootPath = [...this.activePath];

    this.panel.title = `JsonArrayEditor - ${document.fileName.split(/[\\/]/).pop() ?? 'JSON'}`;
    this.panel.webview.postMessage({
      type: 'load',
      model,
      fileName: document.fileName,
      pathLabel: pathToLabel(this.activePath),
    });
  }

  private async chooseChildPath(basePath: Array<string | number>) {
    if (!this.activeDocument) {
      return;
    }

    const text = this.activeDocument.getText();
    const root = parseTree(text);
    if (!root) {
      throw new Error('Could not parse JSON document.');
    }

    const node = getNodeByPath(root, basePath);
    if (!node) {
      throw new Error('Could not resolve child source node.');
    }

    const picks: Array<{ label: string; description: string; path: Array<string | number> }> = [];

    if (node.type === 'object') {
      for (const child of node.children ?? []) {
        const keyNode = child.children?.[0];
        const valueNode = child.children?.[1];
        const key = keyNode ? getNodeValue(keyNode) : undefined;
        if (typeof key === 'string' && valueNode?.type === 'array' && isSupportedArray(valueNode)) {
          picks.push({
            label: key,
            description: pathToLabel([...basePath, key]),
            path: [...basePath, key],
          });
        }
      }
    } else if (node.type === 'array') {
      const value = getNodeValue(node);
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            for (const key of Object.keys(item as Record<string, unknown>)) {
              const childValue = (item as Record<string, unknown>)[key];
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

    const pick = await vscode.window.showQuickPick(
      picks.map((item) => ({
        label: item.label,
        description: item.description,
        item,
      })),
      {
        placeHolder: 'Open child array',
      }
    );

    if (!pick) {
      return;
    }

    await this.load(this.activeDocument, 0, pick.item.path);
  }

  private async goToParent() {
    if (!this.activeDocument) {
      return;
    }

    const text = this.activeDocument.getText();
    const root = parseTree(text);
    if (!root) {
      throw new Error('Could not parse JSON document.');
    }

    const parentPath = findNearestEditableParentPath(root, this.activePath);
    if (!parentPath) {
      return;
    }

    await this.load(this.activeDocument, 0, parentPath);
  }

  private async confirmRemoveColumn(colIndex: number, columnKey: string) {
    const choice = await vscode.window.showWarningMessage(
      `Remove column "${columnKey}"?`,
      { modal: true },
      'Remove'
    );

    this.panel.webview.postMessage({
      type: 'removeColumnResult',
      colIndex,
      confirmed: choice === 'Remove',
    });
  }

  private async saveModel(model: TableModel) {
    if (!this.activeDocument) {
      throw new Error('No active document loaded.');
    }

    const editor = await vscode.window.showTextDocument(this.activeDocument, { preview: false, preserveFocus: true });
    const currentText = this.activeDocument.getText();
    const newValue = materializeValue(model);
    const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 2;

    const edits = modify(currentText, model.path, newValue, {
      formattingOptions: {
        insertSpaces: true,
        tabSize,
      },
      getInsertionIndex: undefined,
    });

    const updatedText = applyEdits(currentText, edits);
    const fullRange = new vscode.Range(
      this.activeDocument.positionAt(0),
      this.activeDocument.positionAt(currentText.length)
    );

    await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, updatedText);
    });

    await this.activeDocument.save();
    await this.load(this.activeDocument, 0, model.path);
    vscode.window.showInformationMessage('JsonArrayEditor: changes saved.');
  }
}