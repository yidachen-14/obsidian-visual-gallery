import { installPdfCompatibility } from "./PdfCompatibility";
import { PDFWorker } from "pdfjs-dist";
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs";

/** Self-contained: community installations download only the three standard assets. */
export class BundledPdfWorker {
  private url: string | null = null;
  private port: Worker | null = null;
  private worker: PDFWorker | null = null;
  private failure: Promise<never> | null = null;

  get(): PDFWorker {
    if (this.worker) return this.worker;
    const url = URL.createObjectURL(new Blob([`(${installPdfCompatibility.toString()})();\n`, workerSource], { type: "text/javascript" }));
    try {
      const port = new Worker(url, { type: "module" });
      this.failure = new Promise((_, reject) => port.addEventListener("error", () => reject(new Error("Local PDF worker could not start.")), { once: true }));
      // The renderer awaits this promise; attach a handler now to avoid a gap.
      void this.failure.catch(() => undefined);
      this.port = port;
      const worker = PDFWorker.create({ port });
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

  async ready(timeout = 10000): Promise<PDFWorker> {
    const worker = this.get();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([worker.promise, this.failure,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Local PDF worker startup timed out.")), timeout); })]);
      return worker;
    } catch (error) { this.dispose(); throw error; }
    finally { if (timer) clearTimeout(timer); }
  }

  dispose(): void {
    this.worker?.destroy();
    this.port?.terminate();
    if (this.url) URL.revokeObjectURL(this.url);
    this.worker = null;
    this.port = null;
    this.url = null;
    this.failure = null;
  }
}
