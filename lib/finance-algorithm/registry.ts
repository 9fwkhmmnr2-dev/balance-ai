export type FinanceAlgorithmMode = "automatic" | "on-demand" | "follow-up" | "deep";
export type FinanceAlgorithmEngineId = "analytics" | "predict" | "savings" | "recommend" | "profile" | "decision" | "documents" | "alerts" | "reports" | "learning";

export const FINANCE_ALGORITHM_POLICY = {
  autonomy: "balanced", learning: "adaptive", priority: "combined",
  requireExplicitConfirmationForFinancialChanges: true,
  personalizationCanBeDisabled: true,
  useFinancialDataForAdvertising: false,
} as const;

export const FINANCE_ALGORITHM_MODES: ReadonlyArray<{id: FinanceAlgorithmMode; label: string; description: string}> = [
  { id: "automatic", label: "Automático", description: "Analiza datos autorizados y avisa solo cuando detecta algo útil." },
  { id: "on-demand", label: "A demanda", description: "Analiza cuando la persona abre un módulo o solicita una evaluación." },
  { id: "follow-up", label: "Seguimiento", description: "Observa la evolución de metas, presupuestos, deudas y ahorros." },
  { id: "deep", label: "Análisis profundo", description: "Cruza módulos autorizados y explica supuestos, límites y resultados." },
];

/** Registry only: a listed engine is not necessarily implemented or enabled. */
export const FINANCE_ALGORITHM_ENGINES: ReadonlyArray<{id: FinanceAlgorithmEngineId; label: string; status: "foundation" | "planned"}> = [
  { id: "analytics", label: "FINANCE ANALYTICS", status: "planned" },
  { id: "predict", label: "FINANCE PREDICT", status: "planned" },
  { id: "savings", label: "FINANCE SAVINGS", status: "foundation" },
  { id: "recommend", label: "FINANCE RECOMMEND", status: "planned" },
  { id: "profile", label: "FINANCE PROFILE", status: "planned" },
  { id: "decision", label: "FINANCE DECISION", status: "planned" },
  { id: "documents", label: "FINANCE DOCUMENTS", status: "planned" },
  { id: "alerts", label: "FINANCE ALERTS", status: "planned" },
  { id: "reports", label: "FINANCE REPORTS", status: "planned" },
  { id: "learning", label: "FINANCE LEARNING", status: "planned" },
];
