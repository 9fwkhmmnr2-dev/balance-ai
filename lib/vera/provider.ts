import type { VeraProvider } from "./types";
import { GeminiVeraProvider } from "./providers/gemini";

export function assertVeraProviderConfigured(): void {
  const provider = (process.env.VERA_AI_PROVIDER || "gemini").toLowerCase();

  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) throw new Error("VERA_AI_NOT_CONFIGURED");
    return;
  }

  throw new Error("VERA_PROVIDER_NOT_SUPPORTED");
}

export function getVeraProvider(): VeraProvider {
  assertVeraProviderConfigured();
  return new GeminiVeraProvider();
}