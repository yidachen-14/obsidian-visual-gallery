/** Safari may return PNG when WebP encoding is unavailable. Preserve its MIME. */
export function thumbnailBlob(canvas: HTMLCanvasElement, quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const accept = (blob: Blob | null) => blob && ["image/webp", "image/png"].includes(blob.type)
      ? resolve(blob) : reject(new Error("Browser could not encode the thumbnail."));
    canvas.toBlob(blob => {
      if (blob) accept(blob);
      else canvas.toBlob(accept, "image/png");
    }, "image/webp", quality);
  });
}
