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
exports.JsonArrayEditorPanel = void 0;
const vscode = __importStar(require("vscode"));
const jsonc_parser_1 = require("jsonc-parser");
const jsonModel_1 = require("./jsonModel");
const webview_1 = require("./webview");
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
        this.panel.webview.html = (0, webview_1.getWebviewHtml)();
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
                    case 'confirmRemoveColumn':
                        await this.confirmRemoveColumn(message.colIndex, message.columnKey);
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
        const targetNode = nestedPath ? (0, jsonModel_1.getNodeByPath)(root, nestedPath) : (0, jsonModel_1.findRelevantEditableNode)(root, cursorOffset);
        if (!targetNode) {
            throw new Error('Cursor is not within a supported JSON array or standalone object.');
        }
        let model;
        if (targetNode.type === 'array') {
            const path = (0, jsonModel_1.getNodePath)(targetNode);
            model = (0, jsonModel_1.buildModelFromArrayNode)(targetNode, path);
            this.activePath = path;
            if (!nestedPath) {
                this.rootPath = [...path];
            }
        }
        else if (targetNode.type === 'object') {
            const path = (0, jsonModel_1.getNodePath)(targetNode);
            model = (0, jsonModel_1.buildModelFromObjectNode)(targetNode, path);
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
            pathLabel: (0, jsonModel_1.pathToLabel)(this.activePath),
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
        const node = (0, jsonModel_1.getNodeByPath)(root, basePath);
        if (!node) {
            throw new Error('Could not resolve child source node.');
        }
        const picks = [];
        if (node.type === 'object') {
            for (const child of node.children ?? []) {
                const keyNode = child.children?.[0];
                const valueNode = child.children?.[1];
                const key = keyNode ? (0, jsonc_parser_1.getNodeValue)(keyNode) : undefined;
                if (typeof key === 'string' && valueNode?.type === 'array' && (0, jsonModel_1.isSupportedArray)(valueNode)) {
                    picks.push({
                        label: key,
                        description: (0, jsonModel_1.pathToLabel)([...basePath, key]),
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
                                const childNode = (0, jsonModel_1.getNodeByPath)(root, [...basePath, i, key]);
                                if (childNode?.type === 'array' && (0, jsonModel_1.isSupportedArray)(childNode)) {
                                    picks.push({
                                        label: `${key} (row ${i + 1})`,
                                        description: (0, jsonModel_1.pathToLabel)([...basePath, i, key]),
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
        const parentPath = (0, jsonModel_1.findNearestEditableParentPath)(root, this.activePath);
        if (!parentPath) {
            return;
        }
        await this.load(this.activeDocument, 0, parentPath);
    }
    async confirmRemoveColumn(colIndex, columnKey) {
        const choice = await vscode.window.showWarningMessage(`Remove column "${columnKey}"?`, { modal: true }, 'Remove');
        this.panel.webview.postMessage({
            type: 'removeColumnResult',
            colIndex,
            confirmed: choice === 'Remove',
        });
    }
    async saveModel(model) {
        if (!this.activeDocument) {
            throw new Error('No active document loaded.');
        }
        const editor = await vscode.window.showTextDocument(this.activeDocument, { preview: false, preserveFocus: true });
        const currentText = this.activeDocument.getText();
        const newValue = (0, jsonModel_1.materializeValue)(model);
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
}
exports.JsonArrayEditorPanel = JsonArrayEditorPanel;
//# sourceMappingURL=panel.js.map