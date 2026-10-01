export function buildThumbnailCacheKey(
  sourcePath: string,
  sourceMtime: number,
  rendererVersion: string,
): string {
  return `${sourcePath}\u0000${sourceMtime}\u0000${rendererVersion}`;
}
