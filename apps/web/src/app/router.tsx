import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Gallery } from "../ui/Gallery";
import { RepositoryProvider } from "../data/RepositoryProvider";
import { Equipo } from "../screens/coach/Equipo";
import { Drilldown } from "../screens/coach/Drilldown";
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
      { index: true, element: <Equipo /> }, // the real coach screen is the front door
      { path: "coach", element: <Equipo /> }, // alias (drill-down navigates under /coach/a/:id)
      { path: "coach/a/:id", element: <Drilldown /> },
      { path: "gallery", element: <Gallery /> }, // dev component showcase, moved off "/"
    ],
  },
]);
