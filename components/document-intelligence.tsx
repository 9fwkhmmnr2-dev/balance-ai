"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

type Transaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: "income" | "expense";
  category: string;
  confidence: number;
  sourcePage: number | null;
  possibleDuplicate: boolean;
  selected: boolean;
  accountId: string;
};
type Account = { id: string; name: string; currency: string };

const panel: CSSProperties = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 18,
  padding: 20,
};
const field: CSSProperties = {
  width: "100%", minWidth: 0, padding: "10px 11px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)", background: "#111827",
  color: "#f8fafc", fontSize: 14,
};

export default function DocumentIntelligence() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);
  const [consent, setConsent] = useState(false);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);

  async function analyze() {
    if (!file) return;
    setBusy(true); setError(""); setMessage(""); setRows([]); setImported(false);
    try {
      const [{ data: sessionData }, { data: accountData, error: accountError }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("financial_accounts").select("id, name, currency").eq("is_archived", false).order("name"),
      ]);
      if (accountError) throw accountError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/vera/documents/analyze", {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos analizar el documento.");
      const availableAccounts = (accountData ?? []) as Account[];
      setAccounts(availableAccounts);
      setRows((payload.transactions ?? []).map((row: Omit<Transaction, "selected" | "accountId">) => ({
        ...row,
        selected: !row.possibleDuplicate,
        accountId: availableAccounts.find((account) => account.currency === row.currency)?.id ?? "",
      })));
      setMessage(`Encontramos ${payload.summary.count} movimientos. Revisalos antes de importar.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, patch: Partial<Transaction>) {
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  async function importSelected() {
    if (!selectedRows.length) return;
    if (selectedRows.some((row) => !row.accountId)) {
      setError("Elegí una cuenta compatible para cada movimiento seleccionado.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const response = await fetch("/api/vera/documents/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: selectedRows.map((row) => ({ date: row.date, description: row.description, amount: row.amount, currency: row.currency, type: row.type, category: row.category, accountId: row.accountId, allowPossibleDuplicate: row.possibleDuplicate })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos importar los movimientos.");
      setImported(true);
      setMessage(`${payload.message} ${payload.skippedDuplicates ? `Se omitieron ${payload.skippedDuplicates} posibles duplicados.` : ""}`);
      setRows((current) => current.map((row) => ({ ...row, selected: false })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 22, color: "#f8fafc" }}>
      <section style={{ ...panel, background: "linear-gradient(135deg, rgba(190,160,105,0.13), rgba(255,255,255,0.025))" }}>
        <div style={{ color: "#d7bd8a", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>VERA GOLD · INTELIGENCIA DOCUMENTAL</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: "12px 0 8px" }}>Tus movimientos, sin cargarlos uno por uno.</h1>
        <p style={{ color: "#aab4c5", lineHeight: 1.6, margin: 0, maxWidth: 680 }}>
          Subí un resumen bancario o un comprobante. VERA detecta operaciones, propone categorías y señala posibles duplicados. Vos revisás y decidís qué importar.
        </p>
      </section>

      <section style={panel}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>1. Elegí un documento</h2>
        <p style={{ margin: "0 0 16px", color: "#9ca8ba", fontSize: 13 }}>PDF, JPG, PNG o WEBP · Máximo 4 MB · El archivo se procesa para el análisis y no se guarda en tu cuenta.</p>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRows([]); setError(""); setMessage(""); setImported(false); }}
          style={{ display: "block", width: "100%", color: "#cbd5e1", marginBottom: 16 }} />
        {file && <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 14 }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", color: "#aab4c5", fontSize: 12, lineHeight: 1.5, marginBottom: 15 }}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Entiendo que el archivo se enviará a Google Gemini para analizarlo. VERA no conserva una copia del documento.</label>
        <button onClick={analyze} disabled={!file || !consent || busy} style={{ border: 0, borderRadius: 11, padding: "12px 18px", background: busy ? "#625a49" : "#c6a66c", color: "#151515", fontWeight: 750, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Analizando con Gemini…" : "Analizar documento"}
        </button>
      </section>

      {error && <div role="alert" style={{ ...panel, borderColor: "rgba(248,113,113,0.45)", color: "#fca5a5" }}>{error}</div>}
      {message && <div role="status" style={{ ...panel, borderColor: "rgba(198,166,108,0.35)", color: "#e6d2ad" }}>{message}</div>}

      {rows.length > 0 && (
        <section style={panel}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>2. Revisá los movimientos</h2>
              <p style={{ color: "#9ca8ba", fontSize: 13, margin: "6px 0 0" }}>{selectedRows.length} seleccionados · {rows.filter((row) => row.possibleDuplicate).length} posibles duplicados</p>
            </div>
            <button onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: !row.possibleDuplicate })))}
              style={{ ...field, width: "auto", cursor: "pointer" }}>Seleccionar no duplicados</button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((row, index) => (
              <article key={index} style={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: 13, padding: 13, opacity: row.selected ? 1 : 0.68 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <input type="checkbox" checked={row.selected} onChange={(event) => updateRow(index, { selected: event.target.checked })} aria-label={`Seleccionar ${row.description}`} />
                  <strong style={{ flex: 1, fontSize: 14 }}>{row.description}</strong>
                  <span style={{ color: row.type === "income" ? "#86efac" : "#fca5a5", fontWeight: 700, fontSize: 13 }}>{row.type === "income" ? "Ingreso" : "Gasto"}</span>
                </div>
                {row.possibleDuplicate && <div style={{ color: "#fbbf24", fontSize: 12, marginBottom: 9 }}>Posible duplicado: ya existe un movimiento con misma fecha, importe, moneda y tipo.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 9 }}>
                  <label style={{ color: "#9ca8ba", fontSize: 11 }}>Fecha<input style={field} type="date" value={row.date} onChange={(e) => updateRow(index, { date: e.target.value })} /></label>
                  <label style={{ color: "#9ca8ba", fontSize: 11 }}>Importe<input style={field} type="number" min="0.01" step="0.01" value={row.amount} onChange={(e) => updateRow(index, { amount: Number(e.target.value) })} /></label>
                  <label style={{ color: "#9ca8ba", fontSize: 11 }}>Tipo<select style={field} value={row.type} onChange={(e) => updateRow(index, { type: e.target.value as Transaction["type"] })}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>
                  <label style={{ color: "#9ca8ba", fontSize: 11 }}>Categoría<input style={field} value={row.category} maxLength={60} onChange={(e) => updateRow(index, { category: e.target.value })} /></label>
                  <label style={{ color: "#9ca8ba", fontSize: 11 }}>Cuenta<select style={field} value={row.accountId} onChange={(e) => updateRow(index, { accountId: e.target.value })}><option value="">Elegir cuenta ({row.currency})</option>{accounts.filter((account) => account.currency === row.currency).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                </div>
                <div style={{ color: "#778397", fontSize: 11, marginTop: 8 }}>Moneda: {row.currency} · Confianza estimada: {Math.round(row.confidence * 100)}%{row.sourcePage ? ` · Página ${row.sourcePage}` : ""}</div>
              </article>
            ))}
          </div>
          <button onClick={importSelected} disabled={busy || imported || !selectedRows.length}
            style={{ marginTop: 18, border: 0, borderRadius: 11, padding: "13px 18px", background: imported ? "#334155" : "#c6a66c", color: imported ? "#cbd5e1" : "#151515", fontWeight: 750, cursor: busy ? "wait" : "pointer", width: "100%" }}>
            {busy ? "Importando…" : imported ? "Importación completada" : `Confirmar e importar ${selectedRows.length} movimientos`}
          </button>
          <p style={{ color: "#778397", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>Al confirmar, solo se guardan los movimientos seleccionados. Se vuelven a validar tu plan, tus cuentas y los posibles duplicados en el servidor.</p>
        </section>
      )}
      <div style={{ color: "#778397", fontSize: 11, lineHeight: 1.5 }}>La IA puede equivocarse. Verificá fechas, importes y categorías con el documento original antes de confirmar.</div>
    </div>
  );
}
