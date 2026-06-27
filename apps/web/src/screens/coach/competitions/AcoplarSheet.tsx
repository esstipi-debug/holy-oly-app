import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Atleta, CompRole, CompetitionEntryInput } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";
import { SegmentedToggle } from "../../../ui/SegmentedToggle";

/** Acoplar atletas (en lote) a una competencia. Lista el plantel que todavía NO está acoplado;
 *  cada selección elige rol pico/paso. El cambio de rol y el desacople de los YA acoplados viven
 *  en la pantalla de detalle. */
export function AcoplarSheet({ open, onClose, roster, yaAcoplados, onAcoplar }: {
  open: boolean;
  onClose: () => void;
  roster: Atleta[];
  yaAcoplados: Set<string>;
  onAcoplar: (entries: CompetitionEntryInput[]) => Promise<void>;
}) {
  const { t } = useTranslation(["coach", "common"]);
  const roleOpts: readonly (readonly [CompRole, string])[] = [["pico", t("rolePico")], ["paso", t("rolePaso")]];
  const candidates = roster.filter((a) => !yaAcoplados.has(a.id));
  const [sel, setSel] = useState<Record<string, CompRole>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries: CompetitionEntryInput[] = Object.entries(sel).map(([athleteId, role]) => ({ athleteId, role }));

  function toggle(id: string): void {
    setSel((s) => {
      const next = { ...s };
      if (id in next) delete next[id];
      else next[id] = "pico";
      return next;
    });
  }
  function setRole(id: string, role: CompRole): void {
    setSel((s) => ({ ...s, [id]: role }));
  }

  async function submit(): Promise<void> {
    if (entries.length === 0) return;
    setError(null); setBusy(true);
    try {
      await onAcoplar(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("acoplarError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t("acoplarTitle")}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{t("acoplarTitle")}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 4 }}>
        {t("acoplarSub")}
      </div>

      {candidates.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)", margin: "16px 0", lineHeight: 1.5 }}>
          {roster.length === 0 ? t("acoplarNoRoster") : t("acoplarAllAttached")}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {candidates.map((a) => {
            const picked = a.id in sel;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 7%,transparent)" }}>
                <button type="button" role="checkbox" aria-checked={picked} aria-label={t("acoplarCheckAria", { name: a.nombre })} onClick={() => toggle(a.id)}
                  style={{ width: 24, height: 24, flex: "0 0 auto", borderRadius: 7, cursor: "pointer",
                    border: `1.5px solid ${picked ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 22%,transparent)"}`,
                    background: picked ? "var(--wl-accent)" : "transparent", color: "var(--wl-bg)", fontWeight: 900, fontSize: 14, lineHeight: 1 }}>
                  {picked ? "✓" : ""}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>{a.nombre}</div>
                  {a.needsRm && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>{t("needsRmHint")}</div>}
                </div>
                {picked && (
                  <SegmentedToggle ariaLabel={t("roleAria", { name: a.nombre })} size="sm" options={roleOpts} value={sel[a.id]!} onChange={(r) => setRole(a.id, r)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" disabled={busy || entries.length === 0} onClick={() => void submit()}
        style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 12, border: 0, cursor: busy || entries.length === 0 ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, opacity: busy || entries.length === 0 ? 0.6 : 1 }}>
        {busy ? "..." : entries.length === 0 ? t("acoplarBtnEmpty") : t("acoplarBtnCount", { count: entries.length })}
      </button>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 10, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        {t("common:cancel")}
      </button>
    </BottomSheet>
  );
}
