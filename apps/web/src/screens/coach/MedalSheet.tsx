import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Medal } from "@holy-oly/core";
import { Medal as MedalIcon } from "../../ui/Medal";
import { BottomSheet } from "../../ui/BottomSheet";

const METALS = [
  { k: "oro", commonKey: "medalGold", place: "1º" },
  { k: "plata", commonKey: "medalSilver", place: "2º" },
  { k: "bronce", commonKey: "medalBronze", place: "3º" },
] as const;

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15,
};
const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
  color: "var(--wl-muted)", marginTop: 12, display: "block",
};

/** YYYY-MM LOCAL — toISOString() es UTC y en Chile salta de mes en la noche del último día. */
function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Coach adds a competition medal (metal + lifts). Mirrors the mock's medal sheet. */
export function MedalSheet({
  open, onClose, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (m: Medal) => Promise<void>;
}) {
  const { t } = useTranslation(["roster", "common"]);
  const [metal, setMetal] = useState<Medal["medal"]>("oro");
  const [comp, setComp] = useState("");
  const [date, setDate] = useState(() => currentYearMonth()); // YYYY-MM de hoy (local)
  const [cat, setCat] = useState("81");
  const [sn, setSn] = useState("");
  const [cj, setCj] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = (Number(sn) || 0) + (Number(cj) || 0);

  async function save(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const place = METALS.find((m) => m.k === metal)!.place;
      await onSubmit({ comp: comp || t("medalDefaultComp"), date: date || currentYearMonth(), cat: cat || "—", medal: metal, sn: Number(sn) || 0, cj: Number(cj) || 0, place });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("medalSaveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t("medalAdd")}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{t("medalAdd")}</div>

      <label style={label}>{t("medalLabel")}</label>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {METALS.map((m) => (
          <button key={m.k} type="button" onClick={() => setMetal(m.k)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${metal === m.k ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
              background: metal === m.k ? "color-mix(in srgb,var(--wl-accent) 14%,transparent)" : "transparent",
              color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 11,
            }}>
            <MedalIcon metal={m.k} size={30} />
            <span>{t(`common:${m.commonKey}`)}</span>
          </button>
        ))}
      </div>

      <label style={label}>{t("medalComp")}</label>
      <input style={input} value={comp} onChange={(e) => setComp(e.target.value)} placeholder={t("medalCompPlaceholder")} />

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><label style={label}>{t("medalDate")}</label><input style={input} type="month" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={label}>{t("medalCat")}</label><input style={input} value={cat} onChange={(e) => setCat(e.target.value)} placeholder="81" /></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><label style={label}>{t("medalSnatch")}</label><input style={input} type="number" inputMode="numeric" value={sn} onChange={(e) => setSn(e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><label style={label}>{t("medalCj")}</label><input style={input} type="number" inputMode="numeric" value={cj} onChange={(e) => setCj(e.target.value)} placeholder="0" /></div>
      </div>

      <div style={{ marginTop: 14, fontFamily: "var(--wl-display)", fontSize: 14, color: "var(--wl-muted)" }}>
        {t("medalTotal")} <b style={{ color: "var(--wl-text)", fontSize: 18 }}>{total}</b> kg
      </div>
      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" onClick={() => void save()} disabled={busy}
        style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
        {busy ? "..." : t("medalSave")}
      </button>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 8, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        {t("common:cancel")}
      </button>
    </BottomSheet>
  );
}
