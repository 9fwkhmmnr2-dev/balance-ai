"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./market-analysis.module.css";

type Metric = {
  id: string;
  code: string;
  label: string;
  unit: string;
  description: string;
  value: number | null;
  year: string | null;
  history: Array<{ year: string; value: number }>;
};
type Payload = {
  country: string;
  provider: string;
  providerUrl: string;
  fetchedAt: string;
  frequency: string;
  metrics: Metric[];
  notice: string;
  error?: string;
};
const countries = [
  ["ARG", "Argentina"], ["BRA", "Brasil"], ["CHL", "Chile"], ["URY", "Uruguay"],
  ["PRY", "Paraguay"], ["USA", "Estados Unidos"], ["CAN", "Canadá"], ["MEX", "México"],
  ["ESP", "España"], ["DEU", "Alemania"], ["FRA", "Francia"], ["GBR", "Reino Unido"],
  ["JPN", "Japón"], ["CHN", "China"], ["IND", "India"], ["ZAF", "Sudáfrica"], ["AUS", "Australia"],
] as const;

function formatValue(value: number | null, unit: string) {
  if (value === null) return "Sin datos";
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
  return unit === "% anual" || unit === "% del PIB" || unit === "% de la fuerza laboral" ? `${formatted}%` : formatted;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MetricCard({ metric }: { metric: Metric }) {
  const points = metric.history.slice(-6);
  const max = Math.max(1, ...points.map((point) => Math.abs(point.value)));
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <span>{metric.label}</span>
        <span className={styles.metricYear}>{metric.year ? `Dato ${metric.year}` : "Sin período"}</span>
      </div>
      <strong className={styles.metricValue}>{formatValue(metric.value, metric.unit)}</strong>
      <p>{metric.description}</p>
      {points.length > 0 ? (
        <div className={styles.sparkline} aria-label={`Evolución anual de ${metric.label}`}>
          {points.map((point) => (
            <div className={styles.sparkColumn} key={point.year} title={`${point.year}: ${formatValue(point.value, metric.unit)}`}>
              <span style={{ height: `${Math.max(8, Math.abs(point.value) / max * 100)}%` }} />
              <small>{point.year.slice(-2)}</small>
            </div>
          ))}
        </div>
      ) : <div className={styles.noHistory}>No hay una serie reciente disponible para este indicador.</div>}
      <small className={styles.metricCode}>Indicador: {metric.code}</small>
    </article>
  );
}

export default function MarketAnalysisView() {
  const [country, setCountry] = useState("ARG");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [access, setAccess] = useState<"checking" | "allowed" | "locked">("checking");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Tu sesión no está disponible.");
        const response = await fetch("/api/vera/entitlement", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No pudimos verificar el acceso.");
        const result = await response.json() as { isGold?: boolean; previewOnly?: boolean };
        if (active) setAccess(result.isGold || result.previewOnly ? "allowed" : "locked");
      } catch {
        if (active) setAccess("locked");
      }
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/market-analysis?country=${country}`, { cache: "no-store" });
      const data = await response.json() as Payload;
      if (!response.ok) throw new Error(data.error || "No pudimos cargar los indicadores.");
      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "No pudimos cargar los indicadores.");
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { if (access === "allowed") void load(); }, [access, load, refresh]);

  const countryName = useMemo(() => countries.find(([code]) => code === country)?.[1] ?? country, [country]);

  if (access === "checking") return <section className={styles.page}><p className={styles.status}>Verificando acceso a FINANCE PLUS…</p></section>;
  if (access === "locked") return (
    <section className={styles.page}>
      <header className={styles.header}><span className={styles.eyebrow}>FINANCE PLUS</span><h1>Análisis de mercados</h1><p>Indicadores económicos y contexto de mercado, con fuente y período.</p></header>
      <div className={styles.locked}><strong>Esta herramienta forma parte de FINANCE PLUS.</strong><p>Con FINANCE PLUS vas a poder consultar indicadores económicos internacionales y su evolución histórica.</p><a href="/vera/gold">Conocer FINANCE PLUS</a></div>
    </section>
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>FINANCE PLUS · INTELIGENCIA ECONÓMICA</span><h1>Análisis de mercados</h1><p>Entendé el contexto económico de distintos países a partir de datos publicados y verificables.</p></div>
        <span className={styles.planTag}>PLUS</span>
      </header>

      <div className={styles.toolbar}>
        <label htmlFor="market-country">País o economía</label>
        <select id="market-country" value={country} onChange={(event) => setCountry(event.target.value)}>
          {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>Actualizar</button>
      </div>

      <div className={styles.sectionIntro}>
        <div><h2>{countryName}</h2><p>Indicadores macroeconómicos seleccionados</p></div>
        <span>Frecuencia: anual</span>
      </div>

      {loading ? <p className={styles.status}>Consultando datos del Banco Mundial…</p> :
        error ? <div className={styles.error}><p>{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div> :
        payload ? <>
          <div className={styles.metrics}>
            {payload.metrics.map((metric) => <MetricCard metric={metric} key={metric.id} />)}
          </div>
          <div className={styles.source}>
            <div><strong>Fuente de datos</strong><p>{payload.provider} · Consulta: {formatDate(payload.fetchedAt)}</p></div>
            <a href={payload.providerUrl} target="_blank" rel="noreferrer">Ver fuente oficial ↗</a>
          </div>
          <p className={styles.notice}>{payload.notice} Los valores más recientes pueden corresponder a años anteriores al actual; cada tarjeta muestra el año efectivo del dato.</p>
        </> : null}
    </section>
  );
}
