import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { localOnlyPdf } from "../build/pdf-local-only.mjs";
import ts from "typescript";

for (const worker of [false, true]) test(`${worker ? "Worker" : "Main"} PDF.js has no callable network or dynamic-code globals`, async () => {
  const source = await readFile(new URL(`../../node_modules/pdfjs-dist/build/${worker ? "pdf.worker" : "pdf"}.mjs`, import.meta.url), "utf8");
  const hardened = await localOnlyPdf(source, worker);
  const tree = ts.createSourceFile("pdf.js", hardened, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const forbidden = [];
  function visit(node) {
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && ts.isIdentifier(node.expression) && ["fetch", "XMLHttpRequest", "Function", "eval", "Worker"].includes(node.expression.text)) forbidden.push(node.expression.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) forbidden.push("dynamic import");
    if (ts.isIdentifier(node) && node.text === "WebAssembly") forbidden.push("WebAssembly");
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.deepEqual(forbidden, []);
  // Probe the exact denial functions shipped in each module without executing
  // the rest of the browser-only PDF.js implementation in Node.
  const boundary = hardened.slice(0, hardened.indexOf("\n", hardened.indexOf("class DeniedPdfRequest")));
  const policy = await import(`data:text/javascript,${encodeURIComponent(boundary + "\nexport { denyPdfNetwork, DeniedPdfRequest };")}`);
  assert.throws(() => policy.denyPdfNetwork("https://example.invalid/private.pdf"), /network access is disabled/);
  assert.throws(() => new policy.DeniedPdfRequest(), /network access is disabled/);
  await assert.rejects(localOnlyPdf(source.replace('new Function("")', 'new Function("changed")'), worker), /re-audit required/);
});
