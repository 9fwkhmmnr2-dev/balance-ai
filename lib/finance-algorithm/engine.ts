import type {
  FinanceAlgorithmAnalysis,
  FinanceAlgorithmInput,
  FinanceAlgorithmInsight,
  FinanceCommitmentInput,
  FinanceConfidence,
  FinanceCurrencySummary,
} from "./types";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const isValidAmount = (value: number) => Number.isFinite(value) && value >= 0;
const isCurrency = (value: string) => /^[A-Z]{3}$/.test(value);

function monthlyIncome(profile: NonNullable<FinanceAlgorithmInput["profile"]>) {
  const amount = profile.typicalIncome;
  if (profile.payFrequency === "none") {
    return { amount: 0, basis: "no_income_reported" as const };
  }
  if (amount === null || !isValidAmount(amount) || profile.payFrequency === "variable" || profile.payFrequency === "not_set") {
    return { amount: null, basis: "not_estimable" as const };
  }

  const factors: Record<"monthly" | "biweekly" | "weekly" | "daily", number> = {
    monthly: 1,
    biweekly: 26 / 12,
    weekly: 52 / 12,
    daily: 365 / 12,
  };
  const factor = factors[profile.payFrequency as keyof typeof factors];
  return { amount: roundMoney(amount * factor), basis: profile.payFrequency === "monthly" ? "reported_monthly" as const : "normalized_frequency" as const };
}

function monthlyCommitment(commitment: FinanceCommitmentInput): number | null {
  if (!isValidAmount(commitment.amount)) return null;
  const factor = commitment.frequency === "weekly" ? 52 / 12 : commitment.frequency === "yearly" ? 1 / 12 : 1;
  const amount = commitment.amount * factor;
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

function summarizeCommitments(commitments: FinanceCommitmentInput[]): FinanceCurrencySummary[] {
  const summaries = new Map<string, FinanceCurrencySummary>();

  for (const commitment of commitments) {
    if (!commitment.isActive || !isCurrency(commitment.currency)) continue;
    const monthly = monthlyCommitment(commitment);
    if (monthly === null) continue;

    const summary = summaries.get(commitment.currency) ?? {
      currency: commitment.currency,
      knownMonthlyCommitments: 0,
      exactMonthlyCommitments: 0,
      approximateMonthlyCommitments: 0,
      activeCommitmentCount: 0,
    };
    summary.knownMonthlyCommitments = roundMoney(summary.knownMonthlyCommitments + monthly);
    if (commitment.amountType === "approximate") {
      summary.approximateMonthlyCommitments = roundMoney(summary.approximateMonthlyCommitments + monthly);
    } else {
      summary.exactMonthlyCommitments = roundMoney(summary.exactMonthlyCommitments + monthly);
    }
    summary.activeCommitmentCount += 1;
    summaries.set(commitment.currency, summary);
  }

  return [...summaries.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

function createInsight(input: Omit<FinanceAlgorithmInsight, "requiresUserConfirmation">): FinanceAlgorithmInsight {
  return { ...input, requiresUserConfirmation: true };
}

function rankInsights(insights: FinanceAlgorithmInsight[], priorities: string[] = []) {
  const preferred: Record<FinanceAlgorithmInsight["kind"], string[]> = {
    cashflow_review: ["debt_management", "expense_organization", "cost_reduction"],
    data_gap: ["expense_organization"],
    goal_follow_up: ["saving", "purchase_planning"],
  };
  return [...insights].sort((a, b) => {
    const score = (item: FinanceAlgorithmInsight) => {
      const index = priorities.findIndex((priority) => preferred[item.kind].includes(priority));
      return index === -1 ? priorities.length + 1 : index;
    };
    return score(a) - score(b);
  });
}

/**
 * Deterministic first-pass analysis.
 * It does not write data, move money, infer purchase intent, or convert currencies.
 */
export function analyzeFinance(input: FinanceAlgorithmInput): FinanceAlgorithmAnalysis {
  const analyzedAt = input.analyzedAt ?? new Date().toISOString();
  const profile = input.profile;
  const insights: FinanceAlgorithmInsight[] = [];
  const missing: string[] = [];
  const caveats: string[] = [];

  if (!profile) {
    missing.push("perfil_financiero");
  }

  const income = profile ? monthlyIncome(profile) : { amount: null, basis: "not_estimable" as const };
  const incomeCurrency = profile && isCurrency(profile.currency) ? profile.currency : null;
  if (profile && !incomeCurrency) missing.push("moneda_de_ingresos");
  if (income.basis === "not_estimable") missing.push("ingresos_mensuales_estimables");

  const activeCommitments = input.commitments.filter((item) => item.isActive);
  const validCommitments = activeCommitments.filter((item) => isValidAmount(item.amount) && isCurrency(item.currency));
  const invalidCommitmentCount = activeCommitments.length - validCommitments.length;
  if (invalidCommitmentCount > 0) {
    caveats.push("Hay compromisos incompletos o inválidos que no se incluyeron en los cálculos.");
  }
  if (validCommitments.some((item) => item.amountType === "approximate")) {
    caveats.push("Parte de los compromisos se informó con importes aproximados.");
  }
  if (validCommitments.some((item) => item.costType === "variable")) {
    caveats.push("Los compromisos variables se normalizan según su frecuencia, pero su importe puede cambiar.");
  }

  const currencies = summarizeCommitments(validCommitments);
  const sameCurrencySummary = incomeCurrency ? currencies.find((item) => item.currency === incomeCurrency) ?? {
    currency: incomeCurrency,
    knownMonthlyCommitments: 0,
    exactMonthlyCommitments: 0,
    approximateMonthlyCommitments: 0,
    activeCommitmentCount: 0,
  } : null;

  let cashflow: FinanceAlgorithmAnalysis["cashflow"] = null;
  if (income.amount !== null && incomeCurrency && sameCurrencySummary) {
    const beforeUnlistedExpenses = roundMoney(income.amount - sameCurrencySummary.knownMonthlyCommitments);
    cashflow = {
      currency: incomeCurrency,
      knownMonthlyCommitments: sameCurrencySummary.knownMonthlyCommitments,
      amountBeforeUnlistedExpenses: beforeUnlistedExpenses,
      status: beforeUnlistedExpenses < 0 ? "commitments_exceed_reported_income" : "nonnegative_before_unlisted_expenses",
    };

    if (beforeUnlistedExpenses < 0) {
      insights.push(createInsight({
        id: "review-known-commitments",
        kind: "cashflow_review",
        priority: "high",
        title: "Conviene revisar los compromisos registrados",
        explanation: "Los compromisos mensuales conocidos superan el ingreso mensual informado en esta moneda. Revisá que los importes y frecuencias estén actualizados antes de tomar decisiones.",
        currency: incomeCurrency,
        amount: Math.abs(beforeUnlistedExpenses),
        confidence: validCommitments.some((item) => item.amountType === "approximate") ? "limited" : "moderate",
        evidence: [
          "Ingreso mensual estimado a partir de la frecuencia informada.",
          "Suma de compromisos activos expresados en la misma moneda.",
        ],
        limitations: [
          "No incluye gastos cotidianos sin importe registrado.",
          "No convierte monedas ni estima ingresos variables.",
          "No demuestra por sí solo una situación de déficit real.",
        ],
      }));
    } else {
      caveats.push("El importe restante es anterior a gastos no registrados; no representa dinero disponible ni capacidad de ahorro.");
    }
  } else if (income.amount !== null && incomeCurrency && currencies.some((item) => item.currency !== incomeCurrency)) {
    cashflow = null;
    caveats.push("No se compararon compromisos en otras monedas con los ingresos: no se aplican conversiones cambiarias.");
  }

  if (!profile || !profile.expenseCategories?.length) {
    missing.push("categorias_de_gastos");
    insights.push(createInsight({
      id: "complete-expense-categories",
      kind: "data_gap",
      priority: "medium",
      title: "Completá las categorías de gastos",
      explanation: "Con las categorías de gastos registradas, el análisis podrá identificar mejor qué información falta para evaluar tu organización financiera.",
      confidence: "limited",
      evidence: ["No se encontraron categorías de gastos en el perfil disponible."],
      limitations: ["Las categorías por sí solas no incluyen importes ni permiten calcular gastos mensuales."],
    }));
  }

  const activeGoals = (input.goals ?? []).filter((goal) => goal.status === "active");
  if (activeGoals.length > 0) {
    insights.push(createInsight({
      id: "review-active-goals",
      kind: "goal_follow_up",
      priority: "low",
      title: "Hay objetivos activos para revisar",
      explanation: "VERA puede relacionar tus objetivos con el presupuesto cuando estén disponibles sus aportes y los datos necesarios, sin asumir cuánto podés destinar.",
      confidence: "limited",
      evidence: [`${activeGoals.length} objetivo(s) activo(s) informado(s).`],
      limitations: ["Esta primera versión no calcula progreso sin los aportes registrados.", "No se recomienda una contribución automática."],
    }));
  }

  if (input.preferences?.personalizationEnabled === false) {
    insights.length = 0;
  } else {
    const intensity = input.preferences?.alertIntensity ?? "balanced";
    const allowed = intensity === "important_only"
      ? ["high"]
      : intensity === "balanced"
        ? ["high", "medium"]
        : ["high", "medium", "low"];
    const visible = insights.filter((item) => allowed.includes(item.priority));
    insights.splice(0, insights.length, ...rankInsights(visible, input.preferences?.priorities));
  }

  caveats.push("Esta versión solo considera compromisos registrados; todavía no incorpora el historial completo de movimientos ni todos los gastos cotidianos.");

  const confidence: FinanceConfidence = missing.length > 1 || caveats.length > 1
    ? "limited"
    : missing.length === 0 && caveats.length === 0
      ? "high"
      : "moderate";

  return {
    version: "1.0.0",
    analyzedAt,
    status: missing.length > 0 ? "incomplete" : "ready",
    income: {
      monthlyEstimate: income.amount,
      currency: incomeCurrency,
      basis: income.basis,
    },
    currencies,
    cashflow,
    dataQuality: { confidence, missing, caveats },
    insights,
  };
}
