export type VeraRole = "user" | "model";

export type VeraMessage = {
  role: VeraRole;
  content: string;
};

export type VeraMemory = {
  category: "goal" | "preference" | "important_detail";
  content: string;
  details: Record<string, string | number | boolean | null>;
};

export type VeraConversationInput = {
  messages: VeraMessage[];
  financialContext?: VeraFinancialContext;
  memories?: VeraMemory[];
};

export type VeraFinancialContext = {
  currency: string;
  period: "daily" | "weekly" | "monthly" | "yearly";
  income: number;
  expenses: number;
  netBalance: number;
  movementsCount: number;
  categoryTotals: Array<{ category: string; amount: number }>;
  previousPeriod?: {
    from: string;
    to: string;
    income: number;
    expenses: number;
    netBalance: number;
    movementsCount: number;
    categoryTotals: Array<{ category: string; amount: number }>;
  };
  goals?: Array<{
    title: string;
    currency: string;
    targetAmount: number;
    savedAmount: number;
    remainingAmount: number;
    progressPercent: number;
    targetDate: string | null;
    status: "active" | "paused" | "completed";
    contributionCount: number;
  }>;
  experience?: "standard" | "gold";
  financialPosition?: {
    currency: string;
    liquidBalance: number | null;
    monthlyIncomeAverage: number;
    monthlyExpensesAverage: number;
    monthlySurplusAverage: number;
    sampleDays: number;
    accountsCount: number;
    balanceComplete: boolean;
    healthRating: "Excelente" | "Saludable" | "Estable" | "Ajustada" | "Crítica" | "Datos insuficientes";
    savingsRatePercent: number | null;
    expenseCoverageMonths: number | null;
  };
  decisionSimulation?: {
    type: "purchase";
    item: string;
    amount: number;
    currency: string;
    currentLiquidBalance: number | null;
    liquidBalanceAfterCashPurchase: number | null;
    monthlySurplusAverage: number;
    projections: Array<{ months: 3 | 6 | 12; baselineLiquidBalance: number | null; purchaseScenarioLiquidBalance: number | null; difference: number | null; differencePercent: number | null }>;
    assumptions: string[];
  };
};

export type VeraProviderResponse = {
  text: string;
  provider: "gemini" | "local";
  model: string;
};

export interface VeraProvider {
  generate(input: VeraConversationInput): Promise<VeraProviderResponse>;
}
