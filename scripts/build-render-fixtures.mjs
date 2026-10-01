import esbuild from "esbuild";
import path from "node:path";
import process from "node:process";

const projectDirectory = process.cwd();
const outputDirectory = path.join(projectDirectory, ".test-build");
await esbuild.build({
  entryPoints: [path.join(projectDirectory, "scripts", "render-fixtures.ts")],
  outfile: path.join(outputDirectory, "render-fixtures.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  alias: {
    obsidian: path.join(projectDirectory, "tests", "obsidian-stub.ts"),
  },
  external: ["@napi-rs/canvas"],
  logLevel: "warning",
});
