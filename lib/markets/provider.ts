export type MarketFrequency = "daily-close";
export type MarketInstrument = {symbol: string; name: string; exchange: string; currency: string; kind: "index" | "equity"};
export type MarketDailyQuote = {symbol: string; name: string; exchange: string; currency: string; close: number; quoteAt: string; retrievedAt: string; sourceName: string; sourceUrl: string; frequency: MarketFrequency};

/** Provider adapters and credentials must remain server-side. */
export interface MarketDataProvider {
  readonly id: string;
  readonly displayName: string;
  getDailyClose(instruments: readonly MarketInstrument[]): Promise<MarketDailyQuote[]>;
}

/** Public display remains disabled until credentials and explicit display rights are confirmed. */
export function getMarketDataReadiness() {
  const provider = process.env.MARKET_DATA_PROVIDER?.trim() || null;
  const hasApiKey = Boolean(process.env.MARKET_DATA_API_KEY?.trim());
  const displayRightsConfirmed = process.env.MARKET_DATA_PUBLIC_DISPLAY_LICENSE === "true";
  return { provider, hasApiKey, displayRightsConfirmed, ready: Boolean(provider && hasApiKey && displayRightsConfirmed), frequency: "daily-close" as const };
}
