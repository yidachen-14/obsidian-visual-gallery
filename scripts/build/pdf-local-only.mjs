import { createHash } from "node:crypto";
import { transform } from "esbuild";

// Pinned PDF.js 5.4.624. A changed upstream implementation fails the build,
// requiring a fresh audit. Keep attribution in the final runtime banner.
export async function localOnlyPdf(source, worker = false) {
  const expected = worker ? "a6a52b63b21b901a70c28d662c72716df14ffbfc4b54436747df333add0649cb" : "e668546e4f396e7769e141b7b0d09aed91c84e1752c7642a2fe87f335dfab84f";
  if (createHash("sha256").update(source).digest("hex") !== expected) throw Error("PDF.js source changed; re-audit required");
  const featureProbe = 'function isEvalSupported() {\n  try {\n    new Function("");\n    return true;\n  } catch {\n    return false;\n  }\n}';
  if (source.split(featureProbe).length !== 2) throw Error("PDF.js eval probe changed; re-audit required");
  source = source.replace(featureProbe, 'function isEvalSupported() { return false; }');
  if (worker) {
    const compiler = /    if \(factory\.isEvalSupported && FeatureTest\.isEvalSupported\) \{\n      const compiled = new PostScriptCompiler\(\)\.compile\(code, domain, range\);\n      if \(compiled\) \{\n        return new Function\("src", "srcOffset", "dest", "destOffset", compiled\);\n      \}\n    \}\n/;
    if (!compiler.test(source)) throw Error("PDF.js PostScript evaluator changed; re-audit required");
    source = source.replace(compiler, '    // Use the upstream PostScript interpreter; dynamic compilation is disabled.\n');
  }
  if (/\bnew Function\s*\(|\beval\s*\(/.test(source)) throw Error("Unaudited PDF.js dynamic execution");
  const dynamicImport = /await import\(\s*\/\*webpackIgnore: true\*\/\s*\/\*@vite-ignore\*\/\s*(?:this\.workerSrc|path)\)/g;
  if ([...source.matchAll(dynamicImport)].length !== 1) throw Error("PDF.js dynamic import changed; re-audit required");
  source = source.replace(dynamicImport, "await denyPdfNetwork()");
  // Lexical substitution affects PDF.js only, including dormant optional-asset
  // paths. It cannot change Obsidian's or another plugin's networking globals.
  const result = await transform(source, {
    format: "esm", target: "es2021", minify: true,
    define: { fetch: "denyPdfNetwork", XMLHttpRequest: "DeniedPdfRequest", Worker: "DeniedPdfRequest", WebAssembly: "undefined" },
  });
  return `function denyPdfNetwork() { throw new Error("Visual Gallery PDF network access is disabled"); }
class DeniedPdfRequest { constructor() { denyPdfNetwork(); } }
${result.code}`;
}
