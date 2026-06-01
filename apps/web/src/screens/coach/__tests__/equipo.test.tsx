import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { Equipo } from "../Equipo";

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

function renderEquipo() {
  const repo = new LocalRepository(new MemStorage());
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach"]}>
        <Routes>
          <Route path="/coach" element={<Equipo />} />
          <Route path="/coach/a/:id" element={<div>DRILLDOWN</div>} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

test("shows the four-bucket counts derived from the seeds (the triage headline)", async () => {
  const { container } = renderEquipo();
  await waitFor(() => expect(container.querySelector('[data-testid="bucket-none"]')).toBeInTheDocument());
  expect(container.querySelector('[data-testid="bucket-alert"]')).toHaveTextContent("2 en alerta");
  expect(container.querySelector('[data-testid="bucket-warn"]')).toHaveTextContent("2 a vigilar");
  expect(container.querySelector('[data-testid="bucket-ok"]')).toHaveTextContent("3 ok");
  expect(container.querySelector('[data-testid="bucket-none"]')).toHaveTextContent("1 sin datos");
});

test("the quadrant plots exactly 7 dots and Tomás (no-data) is absent from the canvas", async () => {
  const { container } = renderEquipo();
  await waitFor(() => expect(container.querySelector('[data-testid="risk-quadrant"]')).toBeInTheDocument());
  const quad = container.querySelector('[data-testid="risk-quadrant"]')!;
  expect(quad.querySelectorAll("circle").length).toBe(7);
  expect(quad.querySelector('g[data-id="tl"]')).toBeNull();
});

test("clicking a name navigates to /coach/a/:id", async () => {
  renderEquipo();
  await waitFor(() => screen.getByRole("button", { name: "Mara V." }));
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  await waitFor(() => expect(screen.getByText("DRILLDOWN")).toBeInTheDocument());
});
