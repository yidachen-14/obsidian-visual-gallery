export interface ThumbnailResult {
  sourcePath: string;
  cachePath: string;
  resourceUrl: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  fromCache: boolean;
  warnings: string[];
}
