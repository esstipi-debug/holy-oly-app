import "@testing-library/jest-dom/vitest";
import i18n from "./i18n";

// Component tests render synchronously. Preload the default-language catalog so react-i18next's
// `useSuspense` never suspends without a <Suspense> boundary in a bare `render()`. Tests are free
// to `await i18n.changeLanguage(...)` to exercise other locales. New namespaces get added here.
await i18n.changeLanguage("es-419");
await i18n.loadNamespaces(["common", "auth", "charts", "account", "coach", "roster"]);
