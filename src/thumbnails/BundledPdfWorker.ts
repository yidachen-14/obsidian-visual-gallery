import { PDFWorker } from "pdfjs-dist";
import workerSource from "pdfjs-dist/build/pdf.worker.min.js";

/** Self-contained: community installations download only the three standard assets. */
export class BundledPdfWorker {
  private url: string | null = null;
  private port: Worker | null = null;
  private worker: PDFWorker | null = null;

  get(): PDFWorker {
    if (this.worker) return this.worker;
    const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    try {
      const port = new Worker(url);
      this.port = port;
      const worker: PDFWorker = PDFWorker.fromPort({ port });
      this.worker = worker;
      this.url = url;
      return worker;
    } catch (error) {
      this.port?.terminate();
      this.port = null;
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  dispose(): void {
    this.worker?.destroy();
    this.port?.terminate();
    if (this.url) URL.revokeObjectURL(this.url);
    this.worker = null;
    this.port = null;
    this.url = null;
  }
}
