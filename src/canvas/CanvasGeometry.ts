import type { CanvasBounds, CanvasSide, JsonCanvasNode } from "./JsonCanvasTypes";

const EMPTY_WIDTH = 480;
const EMPTY_HEIGHT = 320;

export interface RenderDimensions {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  worldWidth: number;
  worldHeight: number;
}

export function computeBounds(nodes: readonly JsonCanvasNode[]): CanvasBounds {
  if (nodes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: EMPTY_WIDTH,
      maxY: EMPTY_HEIGHT,
      width: EMPTY_WIDTH,
      height: EMPTY_HEIGHT,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function computeRenderDimensions(
  bounds: CanvasBounds,
  padding: number,
  maxDimension: number,
  pixelRatio: number,
  minOutputDimension = 96,
): RenderDimensions {
  const worldWidth = Math.max(1, bounds.width + padding * 2);
  const worldHeight = Math.max(1, bounds.height + padding * 2);
  const safeMaxDimension = Math.max(64, Math.floor(maxDimension));
  const safePixelRatio = Math.max(0.25, Math.min(3, pixelRatio));
  const scale = Math.min(safePixelRatio, safeMaxDimension / Math.max(worldWidth, worldHeight));
  const contentWidth = Math.max(1, Math.round(worldWidth * scale));
  const contentHeight = Math.max(1, Math.round(worldHeight * scale));
  const safeMinimum = Math.min(safeMaxDimension, Math.max(1, Math.floor(minOutputDimension)));
  const width = Math.max(safeMinimum, contentWidth);
  const height = Math.max(safeMinimum, contentHeight);
  return {
    width,
    height,
    contentWidth,
    contentHeight,
    offsetX: (width - contentWidth) / 2,
    offsetY: (height - contentHeight) / 2,
    scale,
    worldWidth,
    worldHeight,
  };
}

export function getAnchorPoint(
  node: JsonCanvasNode,
  side: CanvasSide | undefined,
): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: node.x + node.width / 2, y: node.y };
    case "right":
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    case "bottom":
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left":
      return { x: node.x, y: node.y + node.height / 2 };
    default:
      return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }
}
