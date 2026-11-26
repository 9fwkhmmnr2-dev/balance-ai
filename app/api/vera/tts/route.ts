import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!url || !anonKey || !apiKey) return NextResponse.json({ error: "La voz de VERA no está configurada en este entorno." }, { status: 503 });

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 1800) {
      return NextResponse.json({ error: "El texto debe tener entre 1 y 1800 caracteres." }, { status: 400 });
    }

    const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: body.text.trim(), speech_metadata: { style: "Narración profesional, serena y cercana. Español rioplatense natural, ritmo moderado, dicción clara y cálida. Pronunciá importes y porcentajes con claridad. No agregues palabras." } }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { languageCode: "es-US", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        },
      }),
      signal: AbortSignal.timeout(40000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[VERA_TTS] provider response", { status: response.status, model });
      return NextResponse.json({ error: response.status === 429 ? "La voz está ocupada. Probá nuevamente en unos instantes." : "No pudimos generar la voz de VERA en este momento." }, { status: response.status === 429 ? 429 : 502 });
    }
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> };
    const audio = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!audio?.data) return NextResponse.json({ error: "El proveedor no devolvió audio." }, { status: 502 });
    const bytes = Buffer.from(audio.data, "base64");
    return new Response(bytes, { status: 200, headers: { "Content-Type": audio.mimeType || "audio/wav", "Content-Length": String(bytes.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[VERA_TTS] request failed", { code: timedOut ? "TIMEOUT" : "REQUEST_FAILED" });
    return NextResponse.json({ error: timedOut ? "La generación de voz tardó demasiado. Probá otra vez." : "No pudimos generar la voz de VERA." }, { status: 500 });
  }
}
