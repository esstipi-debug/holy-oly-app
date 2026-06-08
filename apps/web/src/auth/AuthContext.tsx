import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as client from "./authClient";
import type { AuthUser, Role } from "./authClient";
import { API_ENABLED } from "../data/apiConfig";

// Auth only applies when the app talks to the API; standalone (localStorage) mode has none.
export { API_ENABLED };

interface AuthValue {
  apiEnabled: boolean;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: Role, name?: string, website?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(API_ENABLED);

  useEffect(() => {
    if (!API_ENABLED) return;
    let on = true;
    client.me()
      .then((u) => { if (on) { setUser(u); setLoading(false); } })
      .catch(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await client.login(email, password);
    setUser(await client.me());
  }, []);

  const signup = useCallback(async (email: string, password: string, role: Role, name?: string, website?: string) => {
    await client.signup(email, password, role, name, website);
    setUser(await client.me());
  }, []);

  const logout = useCallback(async () => {
    await client.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ apiEnabled: API_ENABLED, user, loading, login, signup, logout }),
    [user, loading, login, signup, logout],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}

/** Safe variant — returns null when called outside <AuthProvider> (e.g. demo/test mode).
 *  Use this only in components that already guard on API_ENABLED. */
export function useAuthMaybe(): AuthValue | null {
  return useContext(AuthCtx);
}
