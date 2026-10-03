import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BundledPdfWorker } from "../src/thumbnails/BundledPdfWorker";

const mocks = vi.hoisted(() => ({ destroy: vi.fn(), create: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ PDFWorker: { create: mocks.create } }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs", () => ({ default: "/* local worker */" }));

describe("bundled PDF worker", () => {
  const terminate = vi.fn();
  const create = vi.fn(() => "blob:local-worker");
  const revoke = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockReturnValue({ destroy: mocks.destroy });
    vi.stubGlobal("Worker", vi.fn(function () { return { terminate, addEventListener: vi.fn() }; }));
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lazily creates one local worker and reuses it", () => {
    const bundled = new BundledPdfWorker();
    expect(create).not.toHaveBeenCalled();
    expect(bundled.get()).toBe(bundled.get());
    expect(create).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenCalledWith("blob:local-worker", { type: "module" });
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
    mocks.create.mockImplementationOnce(() => { throw new Error("Worker failure"); });
    const bundled = new BundledPdfWorker();
    expect(() => bundled.get()).toThrow("Worker failure");
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:local-worker");
  });

  it("times out startup instead of hanging the PDF queue", async () => {
    vi.useFakeTimers();
    try {
      mocks.create.mockReturnValueOnce({ destroy: mocks.destroy, promise: new Promise(() => {}) });
      const bundled = new BundledPdfWorker();
      const result = bundled.ready(100);
      const rejected = expect(result).rejects.toThrow("startup timed out");
      await vi.advanceTimersByTimeAsync(100); await rejected;
      expect(terminate).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });

  it("rejects worker error events and releases resources", async () => {
    let error: () => void = () => {};
    vi.stubGlobal("Worker", vi.fn(function () { return { terminate, addEventListener: (_type: string, fn: () => void) => { error = fn; } }; }));
    mocks.create.mockReturnValueOnce({ destroy: mocks.destroy, promise: new Promise(() => {}) });
    const bundled = new BundledPdfWorker(), ready = bundled.ready();
    error(); await expect(ready).rejects.toThrow("could not start");
    expect(terminate).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledOnce();
  });
});
