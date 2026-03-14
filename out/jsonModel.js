"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathToLabel = pathToLabel;
exports.pathsEqual = pathsEqual;
exports.getNodePath = getNodePath;
exports.getNodeByPath = getNodeByPath;
exports.findRelevantEditableNode = findRelevantEditableNode;
exports.findNearestEditableParentPath = findNearestEditableParentPath;
exports.isStandaloneObject = isStandaloneObject;
exports.isSupportedArray = isSupportedArray;
exports.buildModelFromArrayNode = buildModelFromArrayNode;
exports.buildModelFromObjectNode = buildModelFromObjectNode;
exports.detectColumnType = detectColumnType;
exports.materializeValue = materializeValue;
exports.coerceByType = coerceByType;
const jsonc_parser_1 = require("jsonc-parser");
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
function findNearestEditableParentPath(root, currentPath) {
    if (currentPath.length === 0) {
        return undefined;
    }
    for (let i = currentPath.length - 1; i >= 0; i--) {
        const candidate = currentPath.slice(0, i);
        const node = getNodeByPath(root, candidate);
        if (!node) {
            continue;
        }
        if (node.type === 'array' && isSupportedArray(node)) {
            return candidate;
        }
        if (node.type === 'object' && isStandaloneObject(node)) {
            return candidate;
        }
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
            materializeValue,
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
        materializeValue,
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
        materializeValue,
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
//# sourceMappingURL=jsonModel.js.map