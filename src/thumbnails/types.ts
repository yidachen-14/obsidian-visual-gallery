export interface ThumbnailResult {
  sourcePath: string;
  cachePath: string;
  resourceUrl: string;
  mimeType: "image/webp" | "image/png";
  width: number;
  height: number;
  fromCache: boolean;
  warnings: string[];
}
