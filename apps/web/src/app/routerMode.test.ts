import { isHashRouting } from "./routerMode";

test("isHashRouting es true sólo cuando VITE_HASH_ROUTER === 'true'", () => {
  expect(isHashRouting({ VITE_HASH_ROUTER: "true" })).toBe(true);
});

test("isHashRouting es false cuando el flag falta o no es 'true'", () => {
  expect(isHashRouting({})).toBe(false);
  expect(isHashRouting({ VITE_HASH_ROUTER: "false" })).toBe(false);
  expect(isHashRouting({ VITE_HASH_ROUTER: "1" })).toBe(false);
});
