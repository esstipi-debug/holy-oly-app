import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Repository } from "@holy-oly/core";
import { LocalRepository } from "./LocalRepository";
import { HttpRepository } from "./HttpRepository";

const RepoContext = createContext<Repository | null>(null);

/**
 * Default repo for the running app: when VITE_API_URL is set, talk to the API (Fase 2);
 * otherwise fall back to the local seeded store so the front still runs standalone.
 * Tests inject their own repo and bypass this.
 */
function defaultRepository(): Repository {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl ? new HttpRepository(apiUrl) : new LocalRepository();
}

/** Narrows to a repo that needs one-time initialization (only LocalRepository seeds). */
function hasInit(r: Repository): r is Repository & { init(): void } {
  return typeof (r as { init?: unknown }).init === "function";
}

export function RepositoryProvider({ children, repo }: { children: ReactNode; repo?: Repository }) {
  const value = useMemo(() => {
    const r = repo ?? defaultRepository();
    if (hasInit(r)) r.init();
    return r;
  }, [repo]);
  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepository(): Repository {
  const r = useContext(RepoContext);
  if (!r) throw new Error("useRepository must be used within <RepositoryProvider>");
  return r;
}
