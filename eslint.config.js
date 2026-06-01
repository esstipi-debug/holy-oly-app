import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Minimal flat config: TypeScript parsing + the React hooks rules ECC mandates.
// A broader rule set (typescript-eslint recommended, a11y, etc.) is deferred to a
// later quality/hardening pass to avoid a large triage in Fase 0.
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "_mockup/**",
      "**/*.config.{js,ts}",
      "**/coverage/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
