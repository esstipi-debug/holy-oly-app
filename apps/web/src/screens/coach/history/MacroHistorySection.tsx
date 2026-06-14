import { useCallback, useEffect, useRef, useState } from "react";
import type { MacroHistoryView } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { MacroHistoryList } from "../../../ui/MacroHistoryList";
import { RetryButton } from "../../../ui/RetryButton";
import { Loading } from "../../../ui/Loading";

/**
 * "Historial de ciclos" del drill-down del coach (slice macro-history). READ-ONLY: los macrociclos
 * CERRADOS del atleta con su adherencia % (constancia). Carga sus propios datos con error honesto +
 * retry (igual que DailySection/RmSection). El RM de cierre se muestra acá (cara coach); sin ciclos
 * cerrados la lista da su estado vacío honesto.
 */
export function MacroHistorySection({ athleteId }: { athleteId: string }) {
  const repo = useRepository();
  const [view, setView] = useState<MacroHistoryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const v = await repo.getMacroHistory(athleteId);
      if (!mountedRef.current) return;
      setView(v);
      setError(false);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [repo, athleteId]);
  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)" }}>
        No se pudo cargar el historial de ciclos.{" "}
        <RetryButton onClick={() => void load()} fontSize={10.5} />
      </div>
    );
  }
  if (loading) {
    return <Loading style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>Cargando historial…</Loading>;
  }
  if (!view) return null;
  return <MacroHistoryList view={view} audience="coach" />;
}
