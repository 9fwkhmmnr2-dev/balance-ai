import { VERA_SYSTEM_INSTRUCTIONS } from "../instructions";
import type {
  VeraConversationInput,
  VeraProvider,
  VeraProviderResponse,
} from "../types";

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message?: string };
};

function buildContext(input: VeraConversationInput): string {
  if (!input.financialContext) return "";

  return [
    "CONTEXTO FINANCIERO DISPONIBLE (datos proporcionados por FINANCETRACK):",
    JSON.stringify(input.financialContext),
    "Usá estos datos solo como referencia para responder. No infieras información que no esté incluida.",
  ].join("\n");
}

export class GeminiVeraProvider implements VeraProvider {
  async generate(input: VeraConversationInput): Promise<VeraProviderResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("VERA_AI_NOT_CONFIGURED");
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const context = buildContext(input);
    const systemInstruction = [
      VERA_SYSTEM_INSTRUCTIONS,
      context,
    ].filter(Boolean).join("\n\n");

    const contents = input.messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.content }],
    }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 900,
        },
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });

    const payload = (await response.json()) as GeminiResponse;

    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? "VERA_PROVIDER_RATE_LIMIT"
          : "VERA_PROVIDER_UNAVAILABLE"
      );
    }

    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new Error("VERA_EMPTY_RESPONSE");
    }

    return { text, provider: "gemini", model };
  }
}
