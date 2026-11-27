import type { VeraProvider } from "./types";
import { GeminiVeraProvider } from "./providers/gemini";

export function getVeraProvider(): VeraProvider {
  const provider = (process.env.VERA_AI_PROVIDER || "gemini").toLowerCase();

  if (provider === "gemini") {
    return new GeminiVeraProvider();
  }

  throw new Error("VERA_PROVIDER_NOT_SUPPORTED");
}
