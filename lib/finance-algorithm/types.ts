export type FinanceAlgorithmMode = "automatic" | "on-demand" | "follow-up" | "deep";
export type FinancePriority = "saving" | "expense_organization" | "debt_management" | "cost_reduction" | "purchase_planning";
export type FinanceAlertIntensity = "important_only" | "balanced" | "detailed";
export type FinanceConfidence = "limited" | "moderate" | "high";

export type FinanceAlgorithmPreferences = {
  mode?: FinanceAlgorithmMode;
  priorities?: FinancePriority[];
  alertIntensity?: FinanceAlertIntensity;
  interests?: string[];
  personalizationEnabled?: boolean;
};

export type FinanceProfileInput = {
  payFrequency: "monthly" | "biweekly" | "weekly" | "daily" | "variable" | "none" | "not_set";
  typicalIncome: number | null;
  currency: string;
  protectedReserveAmount?: number | null;
  protectedReserveCurrency?: string | null;
  expenseCategories?: string[];
};

export type FinanceCommitmentInput = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: "weekly" | "monthly" | "yearly";
  amountType: "exact" | "approximate";
  costType: "fixed" | "variable";
  isActive: boolean;
};

export type FinanceGoalInput = {
  id: string;
  title: string;
  targetAmount: number;
  currency: string;
  targetDate?: string | null;
  status: "active" | "paused" | "completed" | "archived";
};

export type FinanceAlgorithmInput = {
  profile: FinanceProfileInput | null;
  commitments: FinanceCommitmentInput[];
  goals?: FinanceGoalInput[];
  preferences?: FinanceAlgorithmPreferences;
  analyzedAt?: string;
};

export type FinanceCurrencySummary = {
  currency: string;
  knownMonthlyCommitments: number;
  exactMonthlyCommitments: number;
  approximateMonthlyCommitments: number;
  activeCommitmentCount: number;
};

export type FinanceAlgorithmInsight = {
  id: string;
  kind: "cashflow_review" | "data_gap" | "goal_follow_up";
  priority: "low" | "medium" | "high";
  title: string;
  explanation: string;
  currency?: string;
  amount?: number;
  confidence: FinanceConfidence;
  evidence: string[];
  limitations: string[];
  requiresUserConfirmation: true;
};

export type FinanceAlgorithmAnalysis = {
  version: "1.0.0";
  analyzedAt: string;
  status: "ready" | "incomplete";
  income: {
    monthlyEstimate: number | null;
    currency: string | null;
    basis: "reported_monthly" | "normalized_frequency" | "not_estimable" | "no_income_reported";
  };
  currencies: FinanceCurrencySummary[];
  cashflow: {
    currency: string;
    knownMonthlyCommitments: number;
    amountBeforeUnlistedExpenses: number;
    status: "commitments_exceed_reported_income" | "positive_before_unlisted_expenses" | "not_comparable";
  } | null;
  dataQuality: {
    confidence: FinanceConfidence;
    missing: string[];
    caveats: string[];
  };
  insights: FinanceAlgorithmInsight[];
};
