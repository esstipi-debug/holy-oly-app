import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { RepositoryProvider, useRepository } from "../RepositoryProvider";
import type { Repository } from "@holy-oly/core";

test("useRepository outside a provider throws", () => {
  // renderHook with no wrapper → the hook runs outside any provider.
  expect(() => renderHook(() => useRepository())).toThrow(/RepositoryProvider/);
});

test("init() runs exactly once, even across re-renders", () => {
  let inits = 0;
  // Minimal stub implementing just enough of Repository + an init() the provider calls.
  const repo = { init: () => { inits += 1; } } as unknown as Repository & { init(): void };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repo={repo}>{children}</RepositoryProvider>
  );
  const { rerender } = render(<div />, { wrapper });
  rerender(<div />); // same repo prop → useMemo must not re-run init
  expect(inits).toBe(1);
});
