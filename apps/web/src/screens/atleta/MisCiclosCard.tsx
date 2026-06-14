import { useEffect, useState } from "react";
import type { MacroHistoryView } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";
import { MacroHistoryList } from "../../ui/MacroHistoryList";
import { RetryButton } from "../../ui/RetryButton";

type Load = "loading" | "ready" | "error";

/**
 * «Tus ciclos» (slice macro-history, cara atleta): los macrociclos CERRADOS del propio atleta con
 * su adherencia (su constancia entre ciclos). NUNCA muestra RM (HR-1, audience="atleta") ni RPE.
 * Sin ciclos cerrados → no renderiza (sin culpa, igual que RecorridoCard). Error → alert + reintentar.
 */
export function MisCiclosCard({ client = meClient }: { client?: MeClient } = {}) {
  const [view, setView] = useState<MacroHistoryView | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    let on = true;
    setLoad("loading");
    client.getMeMacroHistory()
      .then((v) => { if (on) { setView(v); setLoad("ready"); } })
      .catch(() => { if (on) setLoad("error"); });
    return () => { on = false; };
  }, [client, stamp]);

  if (load === "loading") return null;
  if (load === "error") {
    return (
      <div className="ho-card">
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
          No se pudo cargar tus ciclos.{" "}
          <RetryButton onClick={() => setStamp((s) => s + 1)} />
        </div>
      </div>
    );
  }
  if (!view || view.cyclesDone === 0) return null; // sin ciclos cerrados todavía → sin card
  return <MacroHistoryList view={view} audience="atleta" title="Tus ciclos" />;
}
