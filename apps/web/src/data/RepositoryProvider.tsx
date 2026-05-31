import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Repository } from "@holy-oly/core";
import { LocalRepository } from "./LocalRepository";

const RepoContext = createContext<Repository | null>(null);

export function RepositoryProvider({ children, repo }: { children: ReactNode; repo?: Repository }) {
  const value = useMemo(() => {
    const r = repo ?? new LocalRepository();
    (r as LocalRepository).init?.();
    return r;
  }, [repo]);
  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepository(): Repository {
  const r = useContext(RepoContext);
  if (!r) throw new Error("useRepository must be used within <RepositoryProvider>");
  return r;
}
