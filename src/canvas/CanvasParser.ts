import type {
  CanvasEnd,
  CanvasSide,
  JsonCanvasData,
  JsonCanvasEdge,
  JsonCanvasNode,
} from "./JsonCanvasTypes";

const NODE_TYPES = new Set(["text", "file", "link", "group"]);
const SIDES = new Set<CanvasSide>(["top", "right", "bottom", "left"]);
const ENDS = new Set<CanvasEnd>(["none", "arrow"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseNode(value: unknown): JsonCanvasNode | null {
  if (!isRecord(value)) return null;
  const { id, type, x, y, width, height } = value;
  if (
    typeof id !== "string" ||
    typeof type !== "string" ||
    !NODE_TYPES.has(type) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const base = { id, type, x, y, width, height, color: optionalString(value.color) };
  switch (type) {
    case "text":
      return { ...base, type, text: optionalString(value.text) ?? "" };
    case "file":
      return {
        ...base,
        type,
        file: optionalString(value.file) ?? "",
        subpath: optionalString(value.subpath),
      };
    case "link":
      return { ...base, type, url: optionalString(value.url) ?? "" };
    case "group": {
      const backgroundStyle = value.backgroundStyle;
      return {
        ...base,
        type,
        label: optionalString(value.label),
        background: optionalString(value.background),
        backgroundStyle:
          backgroundStyle === "cover" || backgroundStyle === "ratio" || backgroundStyle === "repeat"
            ? backgroundStyle
            : undefined,
      };
    }
  }
  return null;
}

function parseEdge(value: unknown): JsonCanvasEdge | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.fromNode !== "string" ||
    typeof value.toNode !== "string"
  ) {
    return null;
  }

  const fromSide = SIDES.has(value.fromSide as CanvasSide) ? (value.fromSide as CanvasSide) : undefined;
  const toSide = SIDES.has(value.toSide as CanvasSide) ? (value.toSide as CanvasSide) : undefined;
  const fromEnd = ENDS.has(value.fromEnd as CanvasEnd) ? (value.fromEnd as CanvasEnd) : undefined;
  const toEnd = ENDS.has(value.toEnd as CanvasEnd) ? (value.toEnd as CanvasEnd) : undefined;
  return {
    id: value.id,
    fromNode: value.fromNode,
    toNode: value.toNode,
    fromSide,
    toSide,
    fromEnd,
    toEnd,
    color: optionalString(value.color),
    label: optionalString(value.label),
  };
}

export function parseJsonCanvas(raw: string): JsonCanvasData {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("Canvas root must be a JSON object.");
  }

  const nodes = Array.isArray(parsed.nodes)
    ? parsed.nodes.map(parseNode).filter((node): node is JsonCanvasNode => node !== null)
    : [];
  const edges = Array.isArray(parsed.edges)
    ? parsed.edges.map(parseEdge).filter((edge): edge is JsonCanvasEdge => edge !== null)
    : [];
  return { nodes, edges };
}
