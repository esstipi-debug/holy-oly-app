import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Gallery } from "../ui/Gallery";
import { RepositoryProvider } from "../data/RepositoryProvider";
import { Equipo } from "../screens/coach/Equipo";
import { DrilldownPlaceholder } from "../screens/coach/DrilldownPlaceholder";
// Explicit type annotation avoids TS2742 (pnpm virtual store internal type).
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: "/",
    element: (
      <RepositoryProvider>
        <App />
      </RepositoryProvider>
    ),
    children: [
      { index: true, element: <Gallery /> }, // kept through M3 for visual regression (TODO: retire when coach build ships)
      { path: "coach", element: <Equipo /> },
      { path: "coach/a/:id", element: <DrilldownPlaceholder /> },
    ],
  },
]);
