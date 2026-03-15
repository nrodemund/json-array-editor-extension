import { findNodeAtOffset, getNodeValue, type Node as JsonNode } from 'jsonc-parser';

export type ColumnType = 'text' | 'longtext' | 'number' | 'bool' | 'color' | 'array' | 'object';

export type ColumnDef = {
  key: string;
  type: ColumnType;
};

export type TableModel = {
  kind: 'object-array' | 'primitive-array' | 'single-object' | 'object-map';
  columns: Array<ColumnDef>;
  rows: Array<Record<string, unknown>>;
  path: Array<string | number>;
  rootPath: Array<string | number>;
  rowKeys?: string[];
};

export function pathToLabel(path: Array<string | number>) {
  return path.length === 0
    ? '$'
    : '$.' + path.map((part) => (typeof part === 'number' ? `[${part}]` : part)).join('.').replace(/\.\[/g, '[');
}

export function pathsEqual(a: Array<string | number>, b: Array<string | number>) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((part, index) => part === b[index]);
}

export function getNodePath(node: JsonNode): Array<string | number> {
  const parts: Array<string | number> = [];
  let current: JsonNode | undefined = node;

  while (current?.parent) {
    const parent: JsonNode = current.parent as JsonNode;

    if (parent.type === 'array') {
      const idx = parent.children?.findIndex((child: JsonNode) => child === current) ?? -1;
      if (idx >= 0) {
        parts.unshift(idx);
      }
    } else if (parent.type === 'property') {
      const keyNode = parent.children?.[0];
      const key = keyNode ? getNodeValue(keyNode) : undefined;
      if (typeof key === 'string') {
        parts.unshift(key);
      }
    }

    current = parent;
  }

  return parts;
}

export function getNodeByPath(root: JsonNode, path: Array<string | number>): JsonNode | undefined {
  let current: JsonNode | undefined = root;

  for (const part of path) {
    if (!current) {
      return undefined;
    }

    if (typeof part === 'number') {
      if (current.type !== 'array') {
        return undefined;
      }
      current = current.children?.[part];
    } else {
      if (current.type !== 'object') {
        return undefined;
      }
      const prop = current.children?.find((child: JsonNode) => {
        const keyNode = child.children?.[0];
        return keyNode && getNodeValue(keyNode) === part;
      });
      current = prop?.children?.[1];
    }
  }

  return current;
}

export function findRelevantEditableNode(root: JsonNode, cursorOffset: number): JsonNode | undefined {
  let node = findNodeAtOffset(root, cursorOffset, true) as JsonNode | undefined;

  while (node) {
    if (node.type === 'array' && isSupportedArray(node)) {
      return node;
    }

    if (node.parent?.type === 'array' && isSupportedArray(node.parent as JsonNode)) {
      return node.parent as JsonNode;
    }

    node = node.parent as JsonNode | undefined;
  }

  node = findNodeAtOffset(root, cursorOffset, true) as JsonNode | undefined;

  while (node) {
    if (node.type === 'object' && isStandaloneObject(node)) {
      return node;
    }

    node = node.parent as JsonNode | undefined;
  }

  return undefined;
}

export function isStandaloneObject(node: JsonNode): boolean {
  if (node.type !== 'object') {
    return false;
  }

  if (node.parent?.type === 'array') {
    return false;
  }

  return true;
}

export function isSupportedArray(arrayNode: JsonNode): boolean {
  if (arrayNode.type !== 'array') {
    return false;
  }

  const values = arrayNode.children ?? [];
  if (values.length === 0) {
    return true;
  }

  const allObjects = values.every((child: JsonNode) => child.type === 'object');
  if (allObjects) {
    return true;
  }

  const allPrimitives = values.every((child: JsonNode) => ['string', 'number', 'boolean', 'null'].includes(child.type));
  return allPrimitives;
}

export function findNearestEditableParentPath(
  root: JsonNode,
  currentPath: Array<string | number>
): Array<string | number> | undefined {
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

export function buildModelFromArrayNode(arrayNode: JsonNode, path: Array<string | number>): TableModel {
  const values = (arrayNode.children ?? []).map((child: JsonNode) => getNodeValue(child));
  const allObjects = values.every((value) => value && typeof value === 'object' && !Array.isArray(value));

  if (allObjects) {
    const rows = values as Array<Record<string, unknown>>;
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const columns: Array<ColumnDef> = keys.map((key) => ({
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

  const primitiveValues = values as Array<unknown>;
  const columns: Array<ColumnDef> = [{ key: 'value', type: detectColumnType(primitiveValues) }];

  return {
    kind: 'primitive-array',
    columns,
    rows: primitiveValues.map((value) => ({ value })),
    path,
    rootPath: [...path],
  };
}

export function buildModelFromObjectNode(objectNode: JsonNode, path: Array<string | number>): TableModel {
  const value = getNodeValue(objectNode);

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Object at cursor is not supported.');
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  const isObjectMap =
    keys.length > 0 &&
    keys.every((key) => {
      const item = obj[key];
      return item && typeof item === 'object' && !Array.isArray(item);
    });

  if (isObjectMap) {
    const rowKeys = [...keys];
    const rows = rowKeys.map((key) => ({ ...(obj[key] as Record<string, unknown>) }));
    const columnKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const columns: Array<ColumnDef> = columnKeys.map((key) => ({
      key,
      type: detectColumnType(rows.map((row) => row[key])),
    }));

    return {
      kind: 'object-map',
      columns,
      rows,
      path,
      rootPath: [...path],
      rowKeys,
    };
  }

  const row = obj;
  const columns: Array<ColumnDef> = keys.map((key) => ({
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

export function detectColumnType(values: Array<unknown>): ColumnType {
  const nonNull = values.filter((value) => value !== null && value !== undefined);
  if (nonNull.length === 0) {
    return 'text';
  }

  if (nonNull.every((value) => Array.isArray(value))) {
    return 'array';
  }

  if (nonNull.every((value) => value && typeof value === 'object' && !Array.isArray(value))) {
    return 'object';
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

  if (looksLikeLongText(values)) {
    return 'longtext';
  }

  return 'text';
}

function looksLikeLongText(values: Array<unknown>): boolean {
  const firstFive = values.slice(0, 5).filter((value) => typeof value === 'string') as string[];
  return firstFive.some((value) => value.length > 100);
}

export function materializeValue(model: TableModel): unknown {
  if (model.kind === 'primitive-array') {
    const key = model.columns[0]?.key ?? 'value';
    return model.rows.map((row) => coerceByType(row[key], model.columns[0]?.type ?? 'text'));
  }

  if (model.kind === 'single-object') {
    const row = model.rows[0] ?? {};
    const out: Record<string, unknown> = {};
    for (const column of model.columns) {
      out[column.key] = coerceByType(row[column.key], column.type);
    }
    return out;
  }

  if (model.kind === 'object-map') {
    const out: Record<string, unknown> = {};
    const rowKeys = model.rowKeys ?? [];
    for (let i = 0; i < model.rows.length; i++) {
      const key = rowKeys[i];
      if (!key) {
        continue;
      }

      const row = model.rows[i] ?? {};
      const rowOut: Record<string, unknown> = {};
      for (const column of model.columns) {
        rowOut[column.key] = coerceByType(row[column.key], column.type);
      }
      out[key] = rowOut;
    }
    return out;
  }

  return model.rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const column of model.columns) {
      out[column.key] = coerceByType(row[column.key], column.type);
    }
    return out;
  });
}

export function coerceByType(value: unknown, type: ColumnType): unknown {
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
      if (typeof value === 'number') return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    case 'bool': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
      }
      return Boolean(value);
    }

    case 'color':
      return typeof value === 'string' ? value : String(value);

    case 'array':
      return Array.isArray(value) ? value : null;

    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;

    case 'longtext':
    case 'text':
    default:
      return typeof value === 'string' ? value : JSON.stringify(value);
  }
}