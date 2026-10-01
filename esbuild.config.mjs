import esbuild from "esbuild";
import process from "node:process";
import { builtinModules } from "node:module";
import { readFile } from "node:fs/promises";

const production = process.argv[2] === "production";
const notices = await Promise.all([
  readFile("LICENSE", "utf8"),
  readFile("THIRD_PARTY_NOTICES.md", "utf8"),
  readFile("PDFJS_LICENSE.txt", "utf8"),
]);
const context = await esbuild.context({
  banner: {
    js: `/* Generated bundle. Source lives in src/.\n${notices.join("\n\n").replaceAll("*/", "* /")}\n*/`,
  },
  plugins: [{
    name: "embed-pdf-worker",
    setup(build) {
      build.onLoad({ filter: /pdf\.worker\.min\.js$/ }, async ({ path }) => ({
        contents: await readFile(path, "utf8"), loader: "text",
      }));
    },
  }],
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2021",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: production,
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
