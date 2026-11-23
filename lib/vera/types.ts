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
};

export type VeraProviderResponse = {
  text: string;
  provider: "gemini";
  model: string;
};

export interface VeraProvider {
  generate(input: VeraConversationInput): Promise<VeraProviderResponse>;
}
