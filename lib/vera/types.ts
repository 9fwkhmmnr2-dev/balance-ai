export type VeraRole = "user" | "model";

export type VeraMessage = {
  role: VeraRole;
  content: string;
};

export type VeraConversationInput = {
  messages: VeraMessage[];
  financialContext?: VeraFinancialContext;
};

export type VeraFinancialContext = {
  currency?: string;
  period?: "daily" | "weekly" | "monthly" | "yearly";
  income?: number;
  expenses?: number;
  netBalance?: number;
  movementsCount?: number;
  categoryTotals?: Array<{ category: string; amount: number }>;
  upcomingIncomeDate?: string | null;
};

export type VeraProviderResponse = {
  text: string;
  provider: "gemini";
  model: string;
};

export interface VeraProvider {
  generate(input: VeraConversationInput): Promise<VeraProviderResponse>;
}
