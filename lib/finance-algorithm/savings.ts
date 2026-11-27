export type SavingsProjection = { months: number; monthlyContribution: number; total: number };

/** Deterministic contribution-only projection; no returns, interest or inflation. */
export function calculateSavingsProjection(monthlyContribution: number, months: number): number | null {
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) return null;
  if (!Number.isInteger(months) || months < 0) return null;
  const total = monthlyContribution * months;
  return Number.isFinite(total) ? Math.round((total + Number.EPSILON) * 100) / 100 : null;
}

export function buildSavingsProjections(monthlyContribution: number, periods: readonly number[]): SavingsProjection[] {
  return periods.flatMap((months) => {
    const total = calculateSavingsProjection(monthlyContribution, months);
    return total === null ? [] : [{ months, monthlyContribution, total }];
  });
}
