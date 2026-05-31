import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Gallery } from "../ui/Gallery";
// Explicit type annotation avoids TS2742 (pnpm virtual store internal type).
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  { path: "/", element: <App />, children: [{ index: true, element: <Gallery /> }] },
]);
