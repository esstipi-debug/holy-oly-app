import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RepositoryProvider } from "../data/RepositoryProvider";
import { AuthProvider } from "../auth/AuthContext";
import { RequireAuth } from "../auth/RequireAuth";
import { RoleLanding } from "../auth/RoleLanding";
import { AuthScreen } from "../auth/AuthScreen";
import { Equipo } from "../screens/coach/Equipo";
import { Drilldown } from "../screens/coach/Drilldown";
import { AtletaScreen } from "../screens/atleta/AtletaScreen";

// Explicit type annotation avoids TS2742 (pnpm virtual store internal type).
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthProvider>
        <RepositoryProvider>
          <App />
        </RepositoryProvider>
      </AuthProvider>
    ),
    children: [
      { index: true, element: <RoleLanding /> }, // redirects by role (or to /login)
      { path: "login", element: <AuthScreen /> },
      { path: "coach", element: <RequireAuth role="coach"><Equipo /></RequireAuth> },
      { path: "coach/a/:id", element: <RequireAuth role="coach"><Drilldown /></RequireAuth> },
      { path: "atleta", element: <RequireAuth role="atleta"><AtletaScreen /></RequireAuth> },
      // dev-only component showcase — lazy import so it's excluded from the production bundle entirely
      ...(import.meta.env.DEV
        ? [{ path: "gallery", lazy: async () => ({ Component: (await import("../ui/Gallery")).Gallery }) }]
        : []),
    ],
  },
]);
