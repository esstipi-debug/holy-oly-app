import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import i18next from "eslint-plugin-i18next";

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
  {
    // i18n anti-hardcoded guard. SCOPED to surfaces that have been migrated and are literal-free,
    // so new hardcoded user-facing text in JSX is blocked there. This glob EXPANDS per phase
    // (Fase 1 adds auth/ + ui/charts, etc.); it is intentionally not global because the
    // un-migrated app still has inline Spanish. `jsx-text-only` flags visible text nodes only
    // (attributes/aria are handled as strings get extracted in their phase).
    files: [
      "apps/web/src/ui/Loading.tsx",
      "apps/web/src/ui/RetryButton.tsx",
      "apps/web/src/i18n/LanguageToggle.tsx",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["error", { mode: "jsx-text-only" }],
    },
  },
);
