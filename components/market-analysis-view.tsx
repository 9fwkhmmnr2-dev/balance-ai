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
type Asset = {
  code: string;
  label: string;
  category: string;
  unit: string;
  description: string;
  explanation: string;
  value: number | null;
  date: string | null;
  history: Array<{ date: string; value: number }>;
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
type AssetPayload = {
  provider: string;
  providerUrl: string;
  fetchedAt: string;
  groups: Array<{ category: string; assets: Asset[] }>;
  notice: string;
  error?: string;
};
type Favorite = {
  market_key: string;
  item_type: "market" | "index" | "company" | "asset";
  display_name: string;
  symbol: string | null;
  country_code: string | null;
};
type FavoriteInput = Omit<Favorite, "market_key"> & { market_key: string };
const countries = [
  ["ARG", "Argentina"], ["BRA", "Brasil"], ["CHL", "Chile"], ["URY", "Uruguay"],
  ["PRY", "Paraguay"], ["USA", "Estados Unidos"], ["CAN", "Canadá"], ["MEX", "México"],
  ["ESP", "España"], ["DEU", "Alemania"], ["FRA", "Francia"], ["GBR", "Reino Unido"],
  ["JPN", "Japón"], ["CHN", "China"], ["IND", "India"], ["ZAF", "Sudáfrica"], ["AUS", "Australia"],
] as const;

const wallStreetIndices = [
  { symbol: "S&P 500", name: "S&P 500", description: "Referencia de grandes empresas cotizadas de Estados Unidos.", key: "index:sp500" },
  { symbol: "NASDAQ", name: "Nasdaq Composite", description: "Índice amplio con fuerte presencia de empresas tecnológicas.", key: "index:nasdaq" },
  { symbol: "DOW", name: "Dow Jones Industrial Average", description: "Índice de 30 grandes compañías estadounidenses.", key: "index:dow" },
];

const companiesByCountry: Record<string, Array<{ name: string; symbol: string; description: string }>> = {
  ARG: [{ name: "YPF", symbol: "BYMA:YPFD", description: "Energía e hidrocarburos · Argentina" }, { name: "Grupo Financiero Galicia", symbol: "BYMA:GGAL", description: "Servicios financieros · Argentina" }],
  BRA: [{ name: "Petrobras", symbol: "B3:PETR4", description: "Energía · Brasil" }, { name: "Vale", symbol: "B3:VALE3", description: "Minería · Brasil" }],
  CHL: [{ name: "Sociedad Química y Minera (SQM)", symbol: "BCS:SQM-B", description: "Minería y materiales · Chile" }, { name: "Banco de Chile", symbol: "NYSE:BCH", description: "Servicios financieros · Chile (ADR)" }],
  USA: [{ name: "Apple", symbol: "NASDAQ:AAPL", description: "Tecnología y electrónica · Estados Unidos" }, { name: "Microsoft", symbol: "NASDAQ:MSFT", description: "Software y servicios tecnológicos · Estados Unidos" }, { name: "NVIDIA", symbol: "NASDAQ:NVDA", description: "Semiconductores · Estados Unidos" }],
  CAN: [{ name: "Royal Bank of Canada", symbol: "TSX:RY", description: "Servicios financieros · Canadá" }, { name: "Shopify", symbol: "TSX:SHOP", description: "Comercio electrónico y software · Canadá" }],
  MEX: [{ name: "América Móvil", symbol: "BMV:AMX", description: "Telecomunicaciones · México" }, { name: "Walmart de México", symbol: "BMV:WALMEX", description: "Comercio minorista · México" }],
  ESP: [{ name: "Banco Santander", symbol: "BME:SAN", description: "Servicios financieros · España" }, { name: "Iberdrola", symbol: "BME:IBE", description: "Energía · España" }],
  DEU: [{ name: "SAP", symbol: "XETRA:SAP", description: "Software empresarial · Alemania" }, { name: "Siemens", symbol: "XETRA:SIE", description: "Industria y tecnología · Alemania" }],
  FRA: [{ name: "L'Oréal", symbol: "EPA:OR", description: "Consumo y cosmética · Francia" }, { name: "TotalEnergies", symbol: "EPA:TTE", description: "Energía · Francia" }],
  GBR: [{ name: "HSBC", symbol: "LSE:HSBA", description: "Servicios financieros · Reino Unido" }, { name: "Shell", symbol: "LSE:SHEL", description: "Energía · Reino Unido" }],
  JPN: [{ name: "Toyota Motor", symbol: "TSE:7203", description: "Automotriz · Japón" }, { name: "Sony Group", symbol: "TSE:6758", description: "Tecnología y entretenimiento · Japón" }],
  CHN: [{ name: "Alibaba Group", symbol: "HKEX:9988", description: "Comercio electrónico y tecnología · China" }, { name: "Baidu", symbol: "NASDAQ:BIDU", description: "Tecnología e internet · China (ADR)" }],
  IND: [{ name: "Reliance Industries", symbol: "NSE:RELIANCE", description: "Energía, comercio y telecomunicaciones · India" }, { name: "Infosys", symbol: "NSE:INFY", description: "Servicios tecnológicos · India" }],
  ZAF: [{ name: "Naspers", symbol: "JSE:NPN", description: "Tecnología e inversiones · Sudáfrica" }, { name: "Standard Bank Group", symbol: "JSE:SBK", description: "Servicios financieros · Sudáfrica" }],
  AUS: [{ name: "BHP Group", symbol: "ASX:BHP", description: "Minería y recursos · Australia" }, { name: "Commonwealth Bank", symbol: "ASX:CBA", description: "Servicios financieros · Australia" }],
};

function formatValue(value: number | null, unit: string) {
  if (value === null) return "Sin datos";
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
  return unit === "% anual" || unit === "% del PIB" || unit === "% de la fuerza laboral" ? `${formatted}%` : formatted;
}

function formatAssetValue(value: number | null, code: string) {
  if (value === null) return "Sin datos";
  const maximumFractionDigits = ["BTC", "ETH", "SOL", "XRP", "USDT", "USDC"].includes(code) ? 4 : ["XAU", "XAG", "XPT", "XPD"].includes(code) ? 2 : 3;
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits, minimumFractionDigits: 2 }).format(value);
}

function FavoriteButton({ active, busy, label, onClick }: { active: boolean; busy: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={`${styles.favoriteButton}${active ? ` ${styles.isActive}` : ""}`} aria-pressed={active} aria-label={active ? `Quitar ${label} de favoritos` : `Seguir ${label}`} title={active ? "Quitar de favoritos" : "Seguir"} onClick={onClick} disabled={busy}>{busy ? "…" : active ? "★ Siguiendo" : "☆ Seguir"}</button>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
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
      <details className={styles.explain}>
        <summary>¿Qué significa este gráfico?</summary>
        <p>{metric.description} El gráfico muestra las últimas observaciones anuales disponibles; cada columna representa un año y su altura permite comparar el valor con los demás años del período. La unidad es {metric.unit}.</p>
        <p>Sirve para entender el contexto económico del país, no para anticipar por sí solo lo que va a ocurrir.</p>
      </details>
      <small className={styles.metricCode}>Indicador: {metric.code}</small>
    </article>
  );
}

function AssetCard({ asset, favorite, busy, onToggle }: { asset: Asset; favorite: boolean; busy: boolean; onToggle: () => void }) {
  const points = asset.history.slice(-8);
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = max - min || Math.abs(max) || 1;
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <span>{asset.label} · {asset.code}</span>
        <span className={styles.metricYear}>{asset.date ? formatDay(asset.date) : "Sin datos"}</span>
      </div>
      <FavoriteButton active={favorite} busy={busy} label={asset.label} onClick={onToggle} />
      <strong className={styles.metricValue}>{formatAssetValue(asset.value, asset.code)}</strong>
      <p>{asset.description}</p>
      {points.length > 0 ? (
        <div className={styles.sparkline} aria-label={`Evolución de referencia de ${asset.label}`}>
          {points.map((point) => (
            <div className={styles.sparkColumn} key={point.date} title={`${formatDay(point.date)}: ${formatAssetValue(point.value, asset.code)}`}>
              <span style={{ height: `${Math.max(8, 12 + ((point.value - min) / range) * 88)}%` }} />
              <small>{point.date.slice(5).replace("-", "/")}</small>
            </div>
          ))}
        </div>
      ) : <div className={styles.noHistory}>No hay observaciones recientes para este activo en la fuente.</div>}
      <details className={styles.explain}>
        <summary>¿Qué significa este gráfico?</summary>
        <p>{asset.explanation}</p>
        <p>{asset.unit}. Las columnas muestran las observaciones de referencia disponibles durante el último mes; la última fecha aparece arriba. No todas las monedas o activos tienen la misma cantidad de observaciones.</p>
      </details>
    </article>
  );
}

export default function MarketAnalysisView() {
  const [country, setCountry] = useState("ARG");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [assetPayload, setAssetPayload] = useState<AssetPayload | null>(null);
  const [assetError, setAssetError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [access, setAccess] = useState<"checking" | "allowed" | "locked">("checking");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState("");
  const [favoriteError, setFavoriteError] = useState("");

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

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    setFavoriteError("");
    try {
      const { data, error: queryError } = await supabase
        .from("market_favorites")
        .select("market_key,item_type,display_name,symbol,country_code")
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setFavorites((data ?? []) as Favorite[]);
    } catch {
      setFavoriteError("No pudimos cargar tus favoritos. Probá actualizar la sección.");
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback(async (item: FavoriteInput) => {
    setFavoriteBusy(item.market_key);
    setFavoriteError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (sessionError || !userId) throw new Error("Iniciá sesión para guardar tus favoritos.");
      const exists = favorites.some((favorite) => favorite.market_key === item.market_key);
      if (exists) {
        const { error: deleteError } = await supabase.from("market_favorites").delete().eq("user_id", userId).eq("market_key", item.market_key);
        if (deleteError) throw deleteError;
        setFavorites((current) => current.filter((favorite) => favorite.market_key !== item.market_key));
      } else {
        const { error: insertError } = await supabase.from("market_favorites").insert({ ...item, user_id: userId });
        if (insertError) throw insertError;
        setFavorites((current) => [item, ...current]);
      }
    } catch (cause) {
      setFavoriteError(cause instanceof Error ? cause.message : "No pudimos actualizar tus favoritos.");
    } finally {
      setFavoriteBusy("");
    }
  }, [favorites]);

  const isFavorite = useCallback((key: string) => favorites.some((favorite) => favorite.market_key === key), [favorites]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setAssetError("");
    const [macroResult, assetResult] = await Promise.allSettled([
      fetch(`/api/market-analysis?country=${country}`, { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as Payload;
        if (!response.ok) throw new Error(data.error || "No pudimos cargar los indicadores.");
        return data;
      }),
      fetch("/api/market-assets", { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as AssetPayload;
        if (!response.ok) throw new Error(data.error || "No pudimos cargar las referencias internacionales.");
        return data;
      }),
    ]);
    if (macroResult.status === "fulfilled") setPayload(macroResult.value);
    else {
      setPayload(null);
      setError(macroResult.reason instanceof Error ? macroResult.reason.message : "No pudimos cargar los indicadores.");
    }
    if (assetResult.status === "fulfilled") setAssetPayload(assetResult.value);
    else {
      setAssetPayload(null);
      setAssetError(assetResult.reason instanceof Error ? assetResult.reason.message : "No pudimos cargar monedas y activos.");
    }
    setLoading(false);
  }, [country]);

  useEffect(() => { if (access === "allowed") { void load(); void loadFavorites(); } }, [access, load, loadFavorites, refresh]);

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
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading || favoritesLoading}>Actualizar</button>
      </div>

      <section className={styles.wallStreetPanel} aria-labelledby="wall-street-title">
        <div className={styles.panelHeading}><div><span className={styles.eyebrow}>MERCADO ESTADOUNIDENSE</span><h2 id="wall-street-title">Wall Street</h2><p>Índices de referencia para seguir el pulso de la bolsa de Estados Unidos.</p></div><span className={styles.marketBadge}>NYSE · NASDAQ</span></div>
        <div className={styles.marketTiles}>
          {wallStreetIndices.map((index) => <article className={styles.marketTile} key={index.key}>
            <div><span className={styles.tileSymbol}>{index.symbol}</span><h3>{index.name}</h3><p>{index.description}</p></div>
            <FavoriteButton active={isFavorite(index.key)} busy={favoriteBusy === index.key} label={index.name} onClick={() => void toggleFavorite({ market_key: index.key, item_type: "index", display_name: index.name, symbol: index.symbol, country_code: "USA" })} />
            <small className={styles.pendingQuote}>Cotización pendiente de fuente autorizada</small>
          </article>)}
        </div>
        <p className={styles.marketFootnote}>Los índices se muestran como referencias de mercado. Todavía no publicamos valores ni variaciones sin una fuente de cotización validada.</p>
      </section>

      <details className={styles.marketGroup}>
        <summary className={styles.marketGroupSummary}><span>Empresas nacionales · {countryName}</span><small className={styles.groupMeta}>{(companiesByCountry[country] ?? []).length} empresas de referencia</small></summary>
        <div className={styles.groupContent}>
          {(companiesByCountry[country] ?? []).length > 0 ? <div className={styles.companyGrid}>
            {(companiesByCountry[country] ?? []).map((company) => {
              const key = `company:${country}:${company.symbol}`;
              return <article className={styles.companyTile} key={key}>
                <div><span className={styles.tileSymbol}>{company.symbol}</span><h3>{company.name}</h3><p>{company.description}</p></div>
                <FavoriteButton active={isFavorite(key)} busy={favoriteBusy === key} label={company.name} onClick={() => void toggleFavorite({ market_key: key, item_type: "company", display_name: company.name, symbol: company.symbol, country_code: country })} />
                <small className={styles.pendingQuote}>Cotización pendiente de fuente autorizada</small>
              </article>;
            })}
          </div> : <div className={styles.stockNotice}><strong>Directorio local en preparación</strong><p>Estamos validando símbolos y cobertura de empresas que cotizan en {countryName}. No vamos a mostrar compañías o precios sin una referencia comprobable.</p></div>}
        </div>
      </details>

      {favoriteError && <p className={styles.favoriteError} role="alert">{favoriteError}</p>}
      {favorites.length > 0 && <details className={styles.favoritesPanel}>
        <summary><span>Tu seguimiento</span><small>{favorites.length} favoritos guardados</small></summary>
        <div className={styles.favoriteChips}>{favorites.map((favorite) => <button type="button" key={favorite.market_key} disabled={favoriteBusy === favorite.market_key} onClick={() => void toggleFavorite(favorite)} title="Quitar de favoritos">★ {favorite.display_name} <span>×</span></button>)}</div>
      </details>}

      {loading ? <p className={styles.status}>Consultando fuentes económicas e internacionales…</p> :
        error ? <div className={styles.error}><p>{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div> :
        payload ? (
          <details className={styles.marketGroup} open>
            <summary className={styles.marketGroupSummary}>
              <span>Indicadores económicos · {countryName}</span>
              <small className={styles.groupMeta}>{payload.metrics.length} indicadores · frecuencia anual</small>
            </summary>
            <div className={styles.groupContent}>
              <div className={styles.metrics}>
                {payload.metrics.map((metric) => <MetricCard metric={metric} key={metric.id} />)}
              </div>
              <div className={styles.source}>
                <div><strong>Fuente de indicadores económicos</strong><p>{payload.provider} · Consulta: {formatDate(payload.fetchedAt)}</p></div>
                <a href={payload.providerUrl} target="_blank" rel="noreferrer">Ver fuente oficial ↗</a>
              </div>
              <p className={styles.notice}>{payload.notice} Los valores más recientes pueden corresponder a años anteriores al actual; cada tarjeta muestra el año efectivo del dato.</p>
            </div>
          </details>
        ) : null}

      <div className={styles.groupHeading}><h2>Mercados y activos internacionales</h2><p>Elegí una categoría para desplegar sus tarjetas</p></div>
      {assetError ? <div className={styles.error}><p>{assetError}</p></div> : assetPayload ? <>
        {assetPayload.groups.map((group) => (
          <details className={styles.marketGroup} key={group.category}>
            <summary className={styles.marketGroupSummary}>
              <span>{group.category}</span>
              <small className={styles.groupMeta}>{group.assets.length} activos</small>
            </summary>
            <div className={styles.groupContent}>
              <div className={styles.metrics}>
                {group.assets.map((asset) => {
                  const key = `asset:${asset.code}`;
                  return <AssetCard asset={asset} key={asset.code} favorite={isFavorite(key)} busy={favoriteBusy === key} onToggle={() => void toggleFavorite({ market_key: key, item_type: "asset", display_name: asset.label, symbol: asset.code, country_code: null })} />;
                })}
              </div>
            </div>
          </details>
        ))}
        <div className={styles.source}>
          <div><strong>Fuente de monedas y activos</strong><p>{assetPayload.provider} · Consulta: {formatDate(assetPayload.fetchedAt)}</p></div>
          <a href={assetPayload.providerUrl} target="_blank" rel="noreferrer">Ver metodología y fuente ↗</a>
        </div>
        <p className={styles.notice}>{assetPayload.notice}</p>
      </> : null}

      <details className={styles.marketGroup}>
        <summary className={styles.marketGroupSummary}>
          <span>Bolsas de valores y empresas</span>
          <small className={styles.groupMeta}>Wall Street y mercados nacionales</small>
        </summary>
        <div className={styles.groupContent}>
          <div className={styles.stockNotice}>
            <strong>Integración bursátil en preparación</strong>
            <p>Vamos a incorporar índices de Wall Street y acciones de empresas de los países disponibles. Antes de publicar cotizaciones necesitamos confirmar una fuente que permita mostrar sus datos dentro de FINANCE.TRACK, con cobertura, retraso y permisos claros.</p>
            <p>Por ahora no mostramos precios estimados ni valores inventados. La sección se habilitará cuando la fuente esté validada.</p>
          </div>
        </div>
      </details>

      <a className={styles.veraEntryCard} href="/vera">
        <div className={styles.veraMark} aria-hidden="true">V</div>
        <div><span className={styles.eyebrow}>ASISTENTE FINANCIERA</span><h2>Continuá con VERA</h2><p>Interpretá el contexto de mercado y conectá esta sección con futuras alertas y notificaciones personalizadas.</p><small>Las notificaciones de mercados todavía no están activas.</small></div>
        <span className={styles.veraArrow} aria-hidden="true">→</span>
      </a>
    </section>
  );
}
