import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MACROCYCLES } from "@holy-oly/core";
import { Chip } from "../../../ui/Chip";
import { MacroCard } from "./MacroCard";
import { macroFilter, FAMILIES, DAYS } from "./macroFilter";

const page: CSSProperties = {
  padding: "14px 13px 84px", color: "var(--wl-text)", background: "var(--wl-bg)",
  minHeight: "100vh", maxWidth: 390, margin: "0 auto",
};
const eyebrow: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".2em", color: "var(--wl-accent)",
};
const title: CSSProperties = {
  fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 28, lineHeight: 1, textTransform: "uppercase",
  color: "var(--wl-text)", margin: "5px 0 0",
};
const search: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 12, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14,
};
const filterLabel: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
  color: "var(--wl-muted)", margin: "12px 0 0",
};
const chipRow: CSSProperties = { display: "flex", gap: 7, overflowX: "auto", padding: "6px 0 4px" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginTop: 13 };

export function MacroCatalog() {
  const navigate = useNavigate();
  const { t } = useTranslation("macros");
  // Si el coach vino desde un atleta (drill-down → "Asignar macro" pasa `?atleta=`), se conserva al
  // abrir un macro para que el AssignSheet lo pre-seleccione y no haya que re-elegirlo de la lista.
  const [params] = useSearchParams();
  const atleta = params.get("atleta");
  const macroHref = (mid: string): string => `/coach/macros/${mid}${atleta ? `?atleta=${encodeURIComponent(atleta)}` : ""}`;
  const [family, setFamily] = useState("Todos");
  const [days, setDays] = useState("Todos");
  const [query, setQuery] = useState("");

  const list = useMemo(() => macroFilter(MACROCYCLES, { family, days, query }), [family, days, query]);

  return (
    <div style={page}>
      <div style={eyebrow}>{t("mcEyebrow", { count: list.length })}</div>
      <h1 style={title}>{t("mcTitle")}</h1>

      <input style={search} value={query} placeholder={t("mcSearchPlaceholder")} onChange={(e) => setQuery(e.target.value)} />

      <div style={filterLabel}>{t("mcFilterSchool")}</div>
      <div style={chipRow}>
        {FAMILIES.map((f) => <Chip key={f} selected={family === f} onClick={() => setFamily(f)}>{f === "Todos" ? t("mcFilterAll") : f}</Chip>)}
      </div>
      <div style={filterLabel}>{t("mcFilterDays")}</div>
      <div style={chipRow}>
        {DAYS.map((d) => <Chip key={d} selected={days === d} onClick={() => setDays(d)}>{d === "Todos" ? t("mcFilterAll") : d}</Chip>)}
      </div>

      {list.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "22px 4px", textAlign: "center" }}>
          {t("mcNoResults")}
        </div>
      ) : (
        <div style={grid}>
          {list.map((m) => <MacroCard key={m.id} macro={m} onOpen={(id) => navigate(macroHref(id))} />)}
        </div>
      )}
    </div>
  );
}
