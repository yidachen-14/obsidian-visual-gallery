/** PDF.js 5 uses newer APIs than some supported iOS/Android WebViews provide.
 * This self-contained function is also prepended to the local worker script.
 * Only missing methods are installed; there is no eval or remote code loading.
 */
export function installPdfCompatibility(): void {
  const promise = Promise as unknown as Record<string, unknown>;
  if (typeof promise.withResolvers !== "function") Object.defineProperty(Promise, "withResolvers", {
    configurable: true, writable: true, value: function () {
      let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    },
  });
  if (typeof promise.try !== "function") Object.defineProperty(Promise, "try", {
    configurable: true, writable: true, value: function (callback: (...args: unknown[]) => unknown, ...args: unknown[]) {
      return new Promise(resolve => resolve(callback(...args)));
    },
  });
  const prototype = Uint8Array.prototype as unknown as Record<string, unknown>;
  if (typeof prototype.toHex !== "function") Object.defineProperty(Uint8Array.prototype, "toHex", {
    configurable: true, writable: true, value: function (this: Uint8Array) {
      let result = ""; for (const byte of this) result += byte.toString(16).padStart(2, "0"); return result;
    },
  });
  if (typeof prototype.toBase64 !== "function") Object.defineProperty(Uint8Array.prototype, "toBase64", {
    configurable: true, writable: true, value: function (this: Uint8Array) {
      let text = "";
      for (let offset = 0; offset < this.length; offset += 8192) text += String.fromCharCode(...this.subarray(offset, offset + 8192));
      return btoa(text);
    },
  });
  if (typeof (Uint8Array as unknown as Record<string, unknown>).fromBase64 !== "function") Object.defineProperty(Uint8Array, "fromBase64", {
    configurable: true, writable: true, value: function (value: string) {
      const text = atob(value); return Uint8Array.from(text, char => char.charCodeAt(0));
    },
  });
}
installPdfCompatibility();
