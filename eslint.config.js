import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "node_modules/", ".sf/"] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["**/*.test.js", "*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
