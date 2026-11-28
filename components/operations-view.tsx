"use client";

import { useMemo, useState, type FormEvent } from "react";
import MobileMenu from "./mobile-menu";
import "../app/operaciones/operaciones.css";

type OperationType =
  | "saving_plan"
  | "expense_review"
  | "debt_review"
  | "purchase_planning"
  | "price_tracking"
  | "goal_follow_up";

type OperationStatus = "active" | "paused" | "completed";

type Operation = {
  id: string;
  title: string;
  type: OperationType;
  amount: number | null;
  currency: string;
  cadence: string;
  nextDate: string;
  status: OperationStatus;
  note: string;
};

const typeLabels: Record<OperationType, string> = {
  saving_plan: "Plan de ahorro",
  expense_review: "Revisión de gastos",
  debt_review: "Seguimiento de deuda",
  purchase_planning: "Planificación de compra",
  price_tracking: "Seguimiento de precios",
  goal_follow_up: "Seguimiento de objetivo",
};

const typeDescriptions: Record<OperationType, string> = {
  saving_plan: "Organizá aportes para alcanzar una meta.",
  expense_review: "Definí un límite y revisá una categoría de gastos.",
  debt_review: "Llevá el seguimiento de un compromiso o deuda.",
  purchase_planning: "Prepará una compra con presupuesto y fecha.",
  price_tracking: "Anotá un precio objetivo para un producto.",
  goal_follow_up: "Elegí un objetivo y definí cómo querés revisarlo.",
};

const initialOperations: Operation[] = [
  {
    id: "demo-1",
    title: "Ahorrar para una notebook",
    type: "saving_plan",
    amount: 650000,
    currency: "ARS",
    cadence: "Cada mes",
    nextDate: "2026-12-05",
    status: "active",
    note: "Ejemplo de una meta de ahorro creada manualmente.",
  },
  {
    id: "demo-2",
    title: "Controlar gastos de entretenimiento",
    type: "expense_review",
    amount: 45000,
    currency: "ARS",
    cadence: "Cada semana",
    nextDate: "2026-12-01",
    status: "active",
    note: "Ejemplo de límite de referencia; no modifica movimientos.",
  },
  {
    id: "demo-3",
    title: "Buscar mejor precio para auriculares",
    type: "price_tracking",
    amount: 80000,
    currency: "ARS",
    cadence: "Revisión manual",
    nextDate: "2026-12-03",
    status: "paused",
    note: "El precio es una referencia ingresada en esta demostración.",
  },
];

const emptyForm = {
  title: "",
  type: "saving_plan" as OperationType,
  amount: "",
  currency: "ARS",
  cadence: "monthly",
  nextDate: "",
  note: "",
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("es-AR")}`;
  }
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  return new Date(value + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function OperationsContent({ embedded = false }: { embedded?: boolean }) {
  const [operations, setOperations] = useState(initialOperations);
  const [filter, setFilter] = useState<"all" | OperationStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");

  const visibleOperations = useMemo(
    () => operations.filter((operation) => filter === "all" || operation.status === filter),
    [operations, filter],
  );

  const activeCount = operations.filter((operation) => operation.status === "active").length;
  const pausedCount = operations.filter((operation) => operation.status === "paused").length;

  const amountLabel = form.type === "saving_plan"
    ? "Importe objetivo"
    : form.type === "expense_review"
      ? "Límite de referencia"
      : form.type === "debt_review"
        ? "Importe de referencia"
        : form.type === "purchase_planning"
          ? "Presupuesto estimado"
          : form.type === "price_tracking"
            ? "Precio objetivo"
            : "Importe opcional";

  function createOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = form.amount.trim() ? Number(form.amount.replace(",", ".")) : null;
    if (!form.title.trim()) {
      setNotice("Ingresá un nombre para la operación.");
      return;
    }
    if (form.amount.trim() && (!Number.isFinite(amount) || amount === null || amount <= 0)) {
      setNotice("Revisá el importe ingresado.");
      return;
    }
    const next: Operation = {
      id: `local-${Date.now()}`,
      title: form.title.trim(),
      type: form.type,
      amount,
      currency: form.currency,
      cadence: form.cadence === "weekly" ? "Cada semana" : form.cadence === "monthly" ? "Cada mes" : "Revisión manual",
      nextDate: form.nextDate,
      status: "active",
      note: form.note.trim() || "Operación creada manualmente en esta vista preliminar.",
    };
    setOperations((current) => [next, ...current]);
    setForm(emptyForm);
    setShowForm(false);
    setFilter("all");
    setNotice("Operación agregada a la vista preliminar. Todavía no se guardó en tu cuenta.");
  }

  function updateStatus(id: string, status: OperationStatus) {
    setOperations((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  function removeOperation(id: string) {
    setOperations((current) => current.filter((item) => item.id !== id));
    setNotice("Operación quitada de la vista preliminar.");
  }

  return (
    <div className={`operations-page ${embedded ? "operations-embedded" : ""}`}>
      {!embedded && <MobileMenu />}
      {!embedded && <header className="operations-nav">
        <a href="/" className="mobile-brand">FINANCE<span>.</span>TRACK</a>
        <nav aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/movimientos">Movimientos</a>
          <a href="/planificacion" aria-current="page">Planificación</a>
          <a href="/perfil">Perfil</a>
        </nav>
      </header>}

      <main className="operations-main">
        <div className="operations-heading">
          <div>
            <p className="operations-eyebrow">ORGANIZACIÓN PERSONAL</p>
            <h1>Operaciones personalizadas</h1>
            <p>Creá y organizá planes de seguimiento según lo que necesitás gestionar.</p>
          </div>
          <button className="operations-primary" type="button" onClick={() => { setNotice(""); setShowForm(true); }}>
            <span aria-hidden="true">＋</span> Nueva operación
          </button>
        </div>

        <div className="operations-preview-note">
          <span className="operations-preview-dot" />
          <div>
            <strong>Vista preliminar</strong>
            <p>Los ejemplos y cambios de esta pantalla son temporales. Todavía no se guardan en tu cuenta ni se conectan al algoritmo.</p>
          </div>
        </div>

        <section className="operations-stats" aria-label="Resumen de operaciones">
          <article className="operations-stat">
            <span>Operaciones en total</span>
            <strong>{operations.length}</strong>
            <small>Incluye todos los estados</small>
          </article>
          <article className="operations-stat">
            <span>En seguimiento</span>
            <strong>{activeCount}</strong>
            <small>Operaciones activas</small>
          </article>
          <article className="operations-stat">
            <span>Pausadas</span>
            <strong>{pausedCount}</strong>
            <small>Sin seguimiento activo</small>
          </article>
        </section>

        <section className="operations-types">
          <div className="operations-section-heading">
            <div><p className="operations-eyebrow">QUÉ PODÉS ORGANIZAR</p><h2>Tipos de operación</h2></div>
            <span>6 categorías iniciales</span>
          </div>
          <div className="operations-type-grid">
            {(Object.keys(typeLabels) as OperationType[]).map((type, index) => (
              <button key={type} type="button" className="operations-type-card" onClick={() => { setForm({ ...emptyForm, type }); setShowForm(true); setNotice(""); }}>
                <span className="operations-type-icon" aria-hidden="true">{["↗", "◷", "▤", "◇", "⌕", "◎"][index]}</span>
                <strong>{typeLabels[type]}</strong>
                <small>{typeDescriptions[type]}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="operations-list-section">
          <div className="operations-section-heading">
            <div><p className="operations-eyebrow">TU ESPACIO DE TRABAJO</p><h2>Mis operaciones</h2></div>
            <label className="operations-filter">Mostrar
              <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="paused">Pausadas</option>
                <option value="completed">Completadas</option>
              </select>
            </label>
          </div>

          {notice && <p className="operations-notice" role="status">{notice}</p>}

          {visibleOperations.length === 0 ? (
            <div className="operations-empty">
              <span aria-hidden="true">＋</span>
              <h3>No hay operaciones en esta categoría</h3>
              <p>Creá una nueva o cambiá el filtro para ver otras operaciones.</p>
              <button type="button" className="operations-secondary" onClick={() => { setFilter("all"); setShowForm(true); }}>Crear operación</button>
            </div>
          ) : (
            <div className="operations-cards">
              {visibleOperations.map((operation) => (
                <article className="operation-card" key={operation.id}>
                  <div className="operation-card-top">
                    <div className="operation-card-title">
                      <span className="operation-card-icon" aria-hidden="true">{operation.type === "saving_plan" ? "↗" : operation.type === "expense_review" ? "◷" : operation.type === "debt_review" ? "▤" : operation.type === "purchase_planning" ? "◇" : operation.type === "price_tracking" ? "⌕" : "◎"}</span>
                      <div><span className="operation-type-label">{typeLabels[operation.type]}</span><h3>{operation.title}</h3></div>
                    </div>
                    <span className={`operation-status status-${operation.status}`}>{operation.status === "active" ? "Activa" : operation.status === "paused" ? "Pausada" : "Completada"}</span>
                  </div>
                  <div className="operation-card-details">
                    <div><small>{operation.amount === null ? "Importe" : amountLabelFor(operation.type)}</small><strong>{operation.amount === null ? "No definido" : formatMoney(operation.amount, operation.currency)}</strong></div>
                    <div><small>Frecuencia</small><strong>{operation.cadence}</strong></div>
                    <div><small>Próxima revisión</small><strong>{formatDate(operation.nextDate)}</strong></div>
                  </div>
                  <p className="operation-note">{operation.note}</p>
                  <div className="operation-actions">
                    {operation.status === "active" && <button type="button" onClick={() => updateStatus(operation.id, "paused")}>Pausar</button>}
                    {operation.status === "paused" && <button type="button" onClick={() => updateStatus(operation.id, "active")}>Reanudar</button>}
                    {operation.status !== "completed" && <button type="button" onClick={() => updateStatus(operation.id, "completed")}>Marcar completada</button>}
                    <button type="button" className="operation-remove" onClick={() => removeOperation(operation.id)}>Quitar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="operations-footer-note">En esta etapa, una operación es un plan de organización y seguimiento. No realiza pagos, transferencias ni cambios en tus movimientos.</p>
      </main>

      {showForm && (
        <div className="operations-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section className="operations-modal" role="dialog" aria-modal="true" aria-labelledby="operation-form-title">
            <div className="operations-modal-heading">
              <div><p className="operations-eyebrow">CONFIGURACIÓN MANUAL</p><h2 id="operation-form-title">Nueva operación</h2><p>Definí qué querés seguir y cómo organizarlo.</p></div>
              <button type="button" className="operations-modal-close" onClick={() => setShowForm(false)} aria-label="Cerrar">×</button>
            </div>
            <form className="operations-form" onSubmit={createOperation}>
              <label>Nombre de la operación<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={80} placeholder="Ej. Ahorrar para una compra" required /></label>
              <label>Tipo de operación<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as OperationType })}>{(Object.keys(typeLabels) as OperationType[]).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select><small>{typeDescriptions[form.type]}</small></label>
              <div className="operations-form-row">
                <label>{amountLabel}<input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Opcional" /></label>
                <label>Moneda<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="BRL">BRL</option></select></label>
              </div>
              <div className="operations-form-row">
                <label>Frecuencia<select value={form.cadence} onChange={(event) => setForm({ ...form, cadence: event.target.value })}><option value="manual">Revisión manual</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label>
                <label>Próxima revisión<input type="date" value={form.nextDate} onChange={(event) => setForm({ ...form, nextDate: event.target.value })} /></label>
              </div>
              <label>Notas <span>(opcional)</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={300} rows={3} placeholder="Agregá contexto o condiciones para esta operación." /></label>
              <div className="operations-form-disclaimer">La frecuencia organiza tus revisiones; no programa pagos ni movimientos automáticos.</div>
              {notice && <p className="operations-notice" role="alert">{notice}</p>}
              <div className="operations-form-actions"><button type="button" className="operations-secondary" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="operations-primary">Agregar a la vista</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function amountLabelFor(type: OperationType) {
  if (type === "saving_plan") return "Objetivo";
  if (type === "expense_review") return "Límite";
  if (type === "debt_review") return "Referencia";
  if (type === "purchase_planning") return "Presupuesto";
  if (type === "price_tracking") return "Precio objetivo";
  return "Importe";
}

