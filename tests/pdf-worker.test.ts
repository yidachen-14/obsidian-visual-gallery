import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BundledPdfWorker } from "../src/thumbnails/BundledPdfWorker";

const mocks = vi.hoisted(() => ({ destroy: vi.fn(), fromPort: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ PDFWorker: { fromPort: mocks.fromPort } }));
vi.mock("pdfjs-dist/build/pdf.worker.min.js", () => ({ default: "/* local worker */" }));

describe("bundled PDF worker", () => {
  const terminate = vi.fn();
  const create = vi.fn(() => "blob:local-worker");
  const revoke = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fromPort.mockReturnValue({ destroy: mocks.destroy });
    vi.stubGlobal("Worker", vi.fn(function () { return { terminate }; }));
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lazily creates one local worker and reuses it", () => {
    const bundled = new BundledPdfWorker();
    expect(create).not.toHaveBeenCalled();
    expect(bundled.get()).toBe(bundled.get());
    expect(create).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenCalledWith("blob:local-worker");
    bundled.dispose();
  });

  it("releases the port and blob exactly once when disposed twice", () => {
    const bundled = new BundledPdfWorker();
    bundled.get(); bundled.dispose(); bundled.dispose();
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:local-worker");
  });

  it("releases resources if PDF.js initialization fails", () => {
    mocks.fromPort.mockImplementationOnce(() => { throw new Error("Worker failure"); });
    const bundled = new BundledPdfWorker();
    expect(() => bundled.get()).toThrow("Worker failure");
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:local-worker");
  });
});
