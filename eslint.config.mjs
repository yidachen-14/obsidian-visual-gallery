import tseslint from "typescript-eslint";
import obsidian from "eslint-plugin-obsidianmd";

// Gates the actionable rules reported by the Community release review.
export default tseslint.config({
  files: ["src/**/*.ts"],
  languageOptions: { parser: tseslint.parser, parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname } },
  plugins: { "@typescript-eslint": tseslint.plugin, obsidianmd: obsidian },
  rules: {
    "@typescript-eslint/unbound-method": "error",
    "@typescript-eslint/no-require-imports": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-deprecated": "error",
    "no-control-regex": "error",
    "obsidianmd/prefer-create-el": "error",
    "obsidianmd/prefer-window-timers": "error",
    "obsidianmd/settings-tab/prefer-setting-definitions": "error",
    "obsidianmd/settings-tab/prefer-update-over-display": "error",
    "obsidianmd/settings-tab/no-deprecated-display": "error",
  },
});
