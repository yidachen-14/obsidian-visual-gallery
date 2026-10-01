export type CanvasColor = string;
export type CanvasSide = "top" | "right" | "bottom" | "left";
export type CanvasEnd = "none" | "arrow";

export interface JsonCanvasNodeBase {
  id: string;
  type: "text" | "file" | "link" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
}

export interface JsonCanvasTextNode extends JsonCanvasNodeBase {
  type: "text";
  text: string;
}

export interface JsonCanvasFileNode extends JsonCanvasNodeBase {
  type: "file";
  file: string;
  subpath?: string;
}

export interface JsonCanvasLinkNode extends JsonCanvasNodeBase {
  type: "link";
  url: string;
}

export interface JsonCanvasGroupNode extends JsonCanvasNodeBase {
  type: "group";
  label?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat";
}

export type JsonCanvasNode =
  | JsonCanvasTextNode
  | JsonCanvasFileNode
  | JsonCanvasLinkNode
  | JsonCanvasGroupNode;

export interface JsonCanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: CanvasSide;
  fromEnd?: CanvasEnd;
  toNode: string;
  toSide?: CanvasSide;
  toEnd?: CanvasEnd;
  color?: CanvasColor;
  label?: string;
}

export interface JsonCanvasData {
  nodes: JsonCanvasNode[];
  edges: JsonCanvasEdge[];
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}
