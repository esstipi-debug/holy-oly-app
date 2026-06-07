import { createBrowserRouter, createHashRouter, type RouteObject } from "react-router-dom";
import { isHashRouting } from "./routerMode";
import { App } from "./App";
import { RepositoryProvider } from "../data/RepositoryProvider";
import { AuthProvider } from "../auth/AuthContext";
import { RequireAuth } from "../auth/RequireAuth";
import { RoleLanding } from "../auth/RoleLanding";
import { AuthScreen } from "../auth/AuthScreen";
import { Equipo } from "../screens/coach/Equipo";
import { Drilldown } from "../screens/coach/Drilldown";
import { InvitacionesScreen } from "../screens/coach/InvitacionesScreen";
import { CoachShell } from "../screens/coach/macros/CoachShell";
import { MacroCatalog } from "../screens/coach/macros/MacroCatalog";
import { MacroDetail } from "../screens/coach/macros/MacroDetail";
import { CuentaStub } from "../screens/coach/macros/CuentaStub";
import { AthleteShell } from "../screens/atleta/AthleteShell";
import { HomeScreen } from "../screens/atleta/HomeScreen";
import { ProgresoScreen } from "../screens/atleta/ProgresoScreen";
import { CuentaMin } from "../screens/atleta/CuentaMin";
import { EntrenoScreen } from "../screens/atleta/EntrenoScreen";
import { VictoriaScreen } from "../screens/atleta/entreno/VictoriaScreen";

const routes: RouteObject[] = [
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
      {
        path: "coach",
        element: <RequireAuth role="coach"><CoachShell /></RequireAuth>,
        children: [
          { index: true, element: <Equipo /> },
          { path: "macros", element: <MacroCatalog /> },
          { path: "macros/:id", element: <MacroDetail /> },
          { path: "a/:id", element: <Drilldown /> },
          { path: "invitaciones", element: <InvitacionesScreen /> },
          { path: "cuenta", element: <CuentaStub /> },
        ],
      },
      {
        path: "atleta",
        element: <RequireAuth role="atleta"><AthleteShell /></RequireAuth>,
        children: [
          { index: true, element: <HomeScreen /> },
          { path: "progreso", element: <ProgresoScreen /> },
          { path: "cuenta", element: <CuentaMin /> },
          { path: "entreno/:week/:idx", element: <EntrenoScreen /> },
          { path: "entreno/:week/:idx/victoria", element: <VictoriaScreen /> },
        ],
      },
      // dev-only component showcase — lazy import so it's excluded from the production bundle entirely
      ...(import.meta.env.DEV
        ? [{ path: "gallery", lazy: async () => ({ Component: (await import("../ui/Gallery")).Gallery }) }]
        : []),
    ],
  },
];

// History routing by default (clean URLs). The single-file `file://` demo build flips to hash
// routing via VITE_HASH_ROUTER — see routerMode.ts. Explicit annotation avoids TS2742; the union
// covers both factories honestly (identical RemixRouter today, defensive if RRD ever diverges).
export const router: ReturnType<typeof createBrowserRouter> | ReturnType<typeof createHashRouter> =
  isHashRouting() ? createHashRouter(routes) : createBrowserRouter(routes);
