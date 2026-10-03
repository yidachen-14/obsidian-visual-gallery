/*
 * Canvas2D reconstruction adapted in part from Embed Canvas
 * (Copyright (c) 2026 Horatio, MIT License).
 * See THIRD_PARTY_NOTICES.md for the complete notice.
 */
import { App, normalizePath, TFile } from "obsidian";
import { decodeImage, type DecodedImage } from "../utils/decodeImage";
import { thumbnailBlob } from "../utils/thumbnailBlob";
import { computeBounds, computeRenderDimensions, getAnchorPoint } from "./CanvasGeometry";
import { parseJsonCanvas } from "./CanvasParser";
import type {
  CanvasEnd,
  JsonCanvasData,
  JsonCanvasEdge,
  JsonCanvasFileNode,
  JsonCanvasGroupNode,
  JsonCanvasNode,
} from "./JsonCanvasTypes";

export interface CanvasRendererOptions {
  maxDimension: number;
  pixelRatio: number;
  padding: number;
  quality: number;
  maxNestedDepth: number;
}

export interface CanvasRenderOutput {
  blob: Blob;
  width: number;
  height: number;
  warnings: string[];
  dependencies: string[];
}

interface RenderState {
  depth: number;
  visitedPaths: Set<string>;
  warnings: string[];
  scale: number;
  dependencies: Set<string>;
}

interface MarkdownSummary {
  title: string;
  excerpt: string;
  image: TFile | null;
}

const DEFAULT_OPTIONS: CanvasRendererOptions = {
  maxDimension: 1600,
  pixelRatio: 1,
  padding: 24,
  quality: 0.86,
  maxNestedDepth: 2,
};

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "avif"]);

export class CanvasRenderer {
  readonly options: CanvasRendererOptions;

  constructor(
    private readonly app: App,
    options: Partial<CanvasRendererOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async render(data: JsonCanvasData, sourcePath: string): Promise<CanvasRenderOutput> {
    const state: RenderState = {
      depth: 0,
      visitedPaths: new Set([sourcePath]),
      warnings: [],
      scale: 1,
      dependencies: new Set(),
    };
    return this.renderData(data, sourcePath, state);
  }

  private async renderData(
    data: JsonCanvasData,
    sourcePath: string,
    state: RenderState,
  ): Promise<CanvasRenderOutput> {
    const bounds = computeBounds(data.nodes);
    const dimensions = computeRenderDimensions(
      bounds,
      this.options.padding,
      this.options.maxDimension,
      this.options.pixelRatio,
    );
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a Canvas2D rendering context.");

    context.fillStyle = "#f8f9fb";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(dimensions.scale, dimensions.scale);
    context.translate(
      -bounds.minX + this.options.padding + dimensions.offsetX / dimensions.scale,
      -bounds.minY + this.options.padding + dimensions.offsetY / dimensions.scale,
    );

    const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
    this.drawEdges(context, data.edges, nodeById);

    const nestedState = { ...state, scale: dimensions.scale };
    for (const node of data.nodes) {
      try {
        await this.drawNode(context, node, sourcePath, nestedState);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        state.warnings.push(`${node.id}: ${detail}`);
        this.drawFallbackNode(context, node, "Preview unavailable");
      }
    }

    const blob = await this.toBlob(canvas);
    return {
      blob,
      width: dimensions.width,
      height: dimensions.height,
      warnings: state.warnings,
      dependencies: [...state.dependencies],
    };
  }

  private drawEdges(
    context: CanvasRenderingContext2D,
    edges: readonly JsonCanvasEdge[],
    nodeById: ReadonlyMap<string, JsonCanvasNode>,
  ): void {
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const edge of edges) {
      const fromNode = nodeById.get(edge.fromNode);
      const toNode = nodeById.get(edge.toNode);
      if (!fromNode || !toNode) continue;

      const from = getAnchorPoint(fromNode, edge.fromSide);
      const to = getAnchorPoint(toNode, edge.toSide);
      const color = resolveCanvasColor(edge.color, "#8b95a7");
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();

      if (edge.fromEnd === "arrow") this.drawArrow(context, to.x, to.y, from.x, from.y, color);
      if ((edge.toEnd ?? "arrow") === "arrow") this.drawArrow(context, from.x, from.y, to.x, to.y, color);
      if (edge.label) this.drawEdgeLabel(context, edge.label, (from.x + to.x) / 2, (from.y + to.y) / 2);
    }
  }

  private async drawNode(
    context: CanvasRenderingContext2D,
    node: JsonCanvasNode,
    sourcePath: string,
    state: RenderState,
  ): Promise<void> {
    if (node.type === "group") {
      await this.drawGroupNode(context, node, sourcePath, state);
      return;
    }
    if (node.type === "file") {
      if (await this.drawFileNode(context, node, sourcePath, state)) return;
    }
    if (node.type === "link") {
      this.drawLinkNode(context, node);
      return;
    }
    this.drawFallbackNode(context, node, node.type === "text" ? node.text : basename(node.file || "File"));
  }

  private async drawGroupNode(
    context: CanvasRenderingContext2D,
    node: JsonCanvasGroupNode,
    sourcePath: string,
    state: RenderState,
  ): Promise<void> {
    const color = resolveCanvasColor(node.color, "#a78bfa");
    context.save();
    this.roundedRect(context, node.x, node.y, node.width, node.height, 14);
    context.clip();
    context.fillStyle = withAlpha(color, 0.09);
    context.fillRect(node.x, node.y, node.width, node.height);
    if (node.background) {
      const background = this.resolveLinkedFile(node.background, sourcePath);
      if (background && this.isImage(background)) {
        state.dependencies.add(background.path);
        const bitmap = await this.loadBitmap(background);
        try {
          this.drawBitmap(context, node, bitmap, node.backgroundStyle === "ratio" ? "contain" : "cover");
        } finally {
          bitmap.close();
        }
      }
    }
    context.restore();

    context.save();
    context.strokeStyle = withAlpha(color, 0.9);
    context.lineWidth = 1.6;
    context.setLineDash([8, 6]);
    this.roundedRect(context, node.x, node.y, node.width, node.height, 14);
    context.stroke();
    context.restore();
    if (node.label) {
      context.fillStyle = "#303747";
      context.font = "600 13px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
      context.fillText(node.label, node.x + 12, node.y + 22, Math.max(1, node.width - 24));
    }
  }

  private async drawFileNode(
    context: CanvasRenderingContext2D,
    node: JsonCanvasFileNode,
    sourcePath: string,
    state: RenderState,
  ): Promise<boolean> {
    const linkedFile = this.resolveLinkedFile(node.file, sourcePath);
    if (!linkedFile) return false;
    state.dependencies.add(linkedFile.path);
    if (this.isImage(linkedFile)) {
      const bitmap = await this.loadBitmap(linkedFile);
      try {
        this.drawBitmap(context, node, bitmap, "cover");
      } finally {
        bitmap.close();
      }
      this.strokeNode(context, node, "#94a3b8");
      return true;
    }
    if (linkedFile.extension.toLowerCase() === "canvas") {
      return this.drawNestedCanvas(context, node, linkedFile, state);
    }
    if (linkedFile.extension.toLowerCase() === "md") {
      await this.drawMarkdownNode(context, node, linkedFile, state);
      return true;
    }
    return false;
  }

  private async drawNestedCanvas(
    context: CanvasRenderingContext2D,
    node: JsonCanvasFileNode,
    canvasFile: TFile,
    state: RenderState,
  ): Promise<boolean> {
    if (state.depth >= this.options.maxNestedDepth || state.visitedPaths.has(canvasFile.path)) {
      const reason = state.visitedPaths.has(canvasFile.path) ? "Nested Canvas cycle" : "Nested Canvas depth limit";
      this.drawFallbackNode(context, node, `${reason}\n${canvasFile.basename}`);
      return true;
    }
    const raw = await this.app.vault.cachedRead(canvasFile);
    const data = parseJsonCanvas(raw);
    const childState: RenderState = {
      depth: state.depth + 1,
      visitedPaths: new Set([...state.visitedPaths, canvasFile.path]),
      warnings: state.warnings,
      scale: state.scale,
      dependencies: state.dependencies,
    };
    const rendered = await this.renderData(data, canvasFile.path, childState);
    const bitmap = await decodeImage(rendered.blob);
    try {
      this.drawBitmap(context, node, bitmap, "contain");
    } finally {
      bitmap.close();
    }
    this.strokeNode(context, node, "#94a3b8");
    return true;
  }

  private async drawMarkdownNode(
    context: CanvasRenderingContext2D,
    node: JsonCanvasFileNode,
    markdownFile: TFile,
    state: RenderState,
  ): Promise<void> {
    const summary = await this.readMarkdownSummary(markdownFile);
    const color = resolveCanvasColor(node.color, "#67b77b");
    context.save();
    this.roundedRect(context, node.x, node.y, node.width, node.height, 10);
    context.clip();
    context.fillStyle = "#ffffff";
    context.fillRect(node.x, node.y, node.width, node.height);

    let textTop = node.y + 18;
    if (summary.image) {
      state.dependencies.add(summary.image.path);
      try {
        const bitmap = await this.loadBitmap(summary.image);
        try {
          const imageHeight = Math.max(36, Math.min(node.height * 0.58, node.height - 42));
          this.drawBitmap(
            context,
            { ...node, y: node.y, height: imageHeight },
            bitmap,
            "cover",
          );
          textTop = node.y + imageHeight + 18;
        } finally {
          bitmap.close();
        }
      } catch (error) {
        console.warn(`[Visual Gallery] Could not render Markdown cover ${summary.image.path}.`, error);
      }
    }

    context.fillStyle = "#202637";
    context.font = "600 14px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
    const titleLines = wrapText(context, summary.title, Math.max(1, node.width - 24), 2);
    this.fillLines(context, titleLines, node.x + 12, textTop, 17);
    const excerptTop = textTop + titleLines.length * 17 + 5;
    const availableHeight = node.y + node.height - excerptTop - 8;
    if (availableHeight > 14 && summary.excerpt) {
      context.fillStyle = "#5b6475";
      context.font = "12px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
      const excerptLines = wrapText(
        context,
        summary.excerpt,
        Math.max(1, node.width - 24),
        Math.max(1, Math.floor(availableHeight / 15)),
      );
      this.fillLines(context, excerptLines, node.x + 12, excerptTop, 15);
    }
    context.restore();
    this.strokeNode(context, node, color);
  }

  private drawLinkNode(context: CanvasRenderingContext2D, node: Extract<JsonCanvasNode, { type: "link" }>): void {
    const color = resolveCanvasColor(node.color, "#e3a63b");
    this.drawNodeSurface(context, node, color);
    let domain = "Link";
    let title = node.url;
    try {
      const url = new URL(node.url);
      domain = url.hostname.replace(/^www\./, "") || "Link";
      title = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? domain);
    } catch {
      // Keep the raw URL for malformed or non-standard links.
    }
    context.fillStyle = "#202637";
    context.font = "600 14px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
    this.fillLines(context, wrapText(context, title || domain, node.width - 24, 3), node.x + 12, node.y + 28, 17);
    context.fillStyle = "#6b7280";
    context.font = "12px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(domain, node.x + 12, node.y + node.height - 14, Math.max(1, node.width - 24));
  }

  private drawFallbackNode(context: CanvasRenderingContext2D, node: JsonCanvasNode, text: string): void {
    const color = resolveCanvasColor(node.color, this.defaultNodeColor(node));
    this.drawNodeSurface(context, node, color);
    context.fillStyle = "#252b3a";
    context.font = "13px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
    const cleanText = markdownToPlainText(text) || this.nodeFallbackLabel(node);
    const maxLines = Math.max(1, Math.floor((node.height - 24) / 16));
    this.fillLines(context, wrapText(context, cleanText, Math.max(1, node.width - 24), maxLines), node.x + 12, node.y + 25, 16);
  }

  private drawNodeSurface(context: CanvasRenderingContext2D, node: JsonCanvasNode, color: string): void {
    context.fillStyle = withAlpha(color, 0.16);
    context.strokeStyle = withAlpha(color, 0.88);
    context.lineWidth = 1.25;
    this.roundedRect(context, node.x, node.y, node.width, node.height, 10);
    context.fill();
    context.stroke();
  }

  private strokeNode(context: CanvasRenderingContext2D, node: JsonCanvasNode, color: string): void {
    context.strokeStyle = withAlpha(color, 0.75);
    context.lineWidth = 1;
    this.roundedRect(context, node.x, node.y, node.width, node.height, 10);
    context.stroke();
  }

  private drawBitmap(
    context: CanvasRenderingContext2D,
    node: Pick<JsonCanvasNode, "x" | "y" | "width" | "height">,
    bitmap: DecodedImage,
    fit: "cover" | "contain",
  ): void {
    const imageWidth = Math.max(1, bitmap.width);
    const imageHeight = Math.max(1, bitmap.height);
    const scale = fit === "cover"
      ? Math.max(node.width / imageWidth, node.height / imageHeight)
      : Math.min(node.width / imageWidth, node.height / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    context.save();
    this.roundedRect(context, node.x, node.y, node.width, node.height, 10);
    context.clip();
    context.fillStyle = "#ffffff";
    context.fillRect(node.x, node.y, node.width, node.height);
    context.drawImage(
      bitmap.source,
      node.x + (node.width - width) / 2,
      node.y + (node.height - height) / 2,
      width,
      height,
    );
    context.restore();
  }

  private async readMarkdownSummary(file: TFile): Promise<MarkdownSummary> {
    const raw = await this.app.vault.cachedRead(file);
    const frontmatter = raw.startsWith("---\n") ? raw.slice(4, raw.indexOf("\n---", 4)) : "";
    const body = frontmatter ? raw.slice(raw.indexOf("\n---", 4) + 4) : raw;
    const frontmatterTitle = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/im)?.[1]?.trim();
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const title = frontmatterTitle || heading || file.basename;
    const wikiImage = body.match(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/)?.[1];
    const markdownImage = body.match(/!\[[^\]]*\]\((?!https?:\/\/)([^)\s]+)(?:\s+["'][^"']*["'])?\)/)?.[1];
    const imagePath = wikiImage || markdownImage;
    const image = imagePath ? this.resolveLinkedFile(imagePath, file.path) : null;
    const excerpt = markdownToPlainText(body.replace(/!\[\[[^\]]+\]\]/g, "").replace(/!\[[^\]]*\]\([^)]+\)/g, ""));
    return { title, excerpt: excerpt.slice(0, 420), image: image && this.isImage(image) ? image : null };
  }

  private resolveLinkedFile(rawPath: string, sourcePath: string): TFile | null {
    const linkPath = extractLinkPath(rawPath);
    if (!linkPath) return null;
    const resolved = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
    if (resolved instanceof TFile) return resolved;

    const directCandidates = new Set<string>([linkPath, normalizePath(linkPath.replace(/^\/+/, ""))]);
    const sourceDirectory = dirname(sourcePath);
    if (sourceDirectory) directCandidates.add(normalizePath(`${sourceDirectory}/${linkPath}`));
    for (const candidate of directCandidates) {
      const found = this.app.vault.getFileByPath(candidate);
      if (found) return found;
    }
    return null;
  }

  private isImage(file: TFile): boolean {
    return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
  }

  private async loadBitmap(file: TFile): Promise<DecodedImage> {
    const bytes = await this.app.vault.readBinary(file);
    const blob = new Blob([bytes], { type: imageMimeType(file.extension) });
    return decodeImage(blob);
  }

  private drawEdgeLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number): void {
    context.font = "12px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
    const width = context.measureText(label).width;
    context.fillStyle = "rgba(248, 249, 251, 0.94)";
    context.fillRect(x - width / 2 - 6, y - 11, width + 12, 18);
    context.fillStyle = "#303747";
    context.fillText(label, x - width / 2, y + 3);
  }

  private drawArrow(
    context: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
  ): void {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size = 8;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(toX, toY);
    context.lineTo(toX - size * Math.cos(angle - Math.PI / 7), toY - size * Math.sin(angle - Math.PI / 7));
    context.lineTo(toX - size * Math.cos(angle + Math.PI / 7), toY - size * Math.sin(angle + Math.PI / 7));
    context.closePath();
    context.fill();
  }

  private roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  private fillLines(
    context: CanvasRenderingContext2D,
    lines: readonly string[],
    x: number,
    y: number,
    lineHeight: number,
  ): void {
    lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  }

  private nodeFallbackLabel(node: JsonCanvasNode): string {
    if (node.type === "file") return basename(node.file || "File");
    if (node.type === "link") return node.url || "Link";
    if (node.type === "group") return node.label || "Group";
    return "Text node";
  }

  private defaultNodeColor(node: JsonCanvasNode): string {
    if (node.type === "text") return "#6ea8fe";
    if (node.type === "file") return "#67b77b";
    if (node.type === "link") return "#e3a63b";
    return "#a78bfa";
  }

  private toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return thumbnailBlob(canvas, this.options.quality);
  }
}

export function wrapText(
  context: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || maxLines <= 0) return [];
  const characters = Array.from(normalized);
  const lines: string[] = [];
  let current = "";
  let consumed = 0;

  for (const character of characters) {
    const candidate = current + character;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current.trimEnd());
      if (lines.length >= maxLines) break;
      current = character.trimStart();
    } else {
      current = candidate;
    }
    consumed += 1;
  }
  if (lines.length < maxLines && current) lines.push(current.trimEnd());
  if (consumed < characters.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const last = lines[lastIndex] ?? "";
    lines[lastIndex] = `${last.replace(/[\s.…]+$/u, "")}…`;
  }
  return lines;
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "$2 $1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCanvasColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
  const presets: Record<string, string> = {
    "1": "#e86b6b",
    "2": "#ef9f55",
    "3": "#dfbd52",
    "4": "#62bd7c",
    "5": "#56b7c9",
    "6": "#9b7bd9",
  };
  return presets[raw] ?? fallback;
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  const expanded = hex.length === 3 ? Array.from(hex).map((character) => character.repeat(2)).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return color;
  return `rgba(${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(expanded.slice(2, 4), 16)}, ${Number.parseInt(expanded.slice(4, 6), 16)}, ${alpha})`;
}

function extractLinkPath(rawPath: string): string | null {
  let cleaned = rawPath.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("![[") && cleaned.endsWith("]]")) cleaned = cleaned.slice(3, -2);
  else if (cleaned.startsWith("[[") && cleaned.endsWith("]]")) cleaned = cleaned.slice(2, -2);
  cleaned = cleaned.split("|")[0]?.split("#")[0]?.trim() ?? "";
  if (!cleaned || /^(?:https?:|data:)/i.test(cleaned)) return null;
  try {
    return normalizePath(decodeURIComponent(cleaned.replace(/^\/+/, "")));
  } catch {
    return normalizePath(cleaned.replace(/^\/+/, ""));
  }
}

function imageMimeType(extension: string): string {
  const types: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return types[extension.toLowerCase()] ?? "application/octet-stream";
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}
