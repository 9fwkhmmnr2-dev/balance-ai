import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavedMessage = { role: "user" | "model"; content: string };

function isMessages(value: unknown): value is SavedMessage[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 100 &&
    value.every((item) =>
      item &&
      typeof item === "object" &&
      ((item as SavedMessage).role === "user" || (item as SavedMessage).role === "model") &&
      typeof (item as SavedMessage).content === "string" &&
      (item as SavedMessage).content.trim().length > 0 &&
      (item as SavedMessage).content.length <= 3000
    );
}

async function getUserClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 }) };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { error: NextResponse.json({ error: "El historial no está configurado." }, { status: 503 }) };

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "Tu sesión venció." }, { status: 401 }) };
  return { supabase, userId: data.user.id };
}

export async function GET(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const url = new URL(request.url);
    const archived = url.searchParams.get("archived") === "true";
    const conversationId = url.searchParams.get("id");
    if (conversationId) {
      const { data, error } = await supabase
        .from("vera_conversations")
        .select("id, title, messages, last_message_at, archived_at")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "No encontré esa conversación." }, { status: 404 });
      return NextResponse.json({ conversation: data });
    }

    if (!archived) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("vera_conversations")
        .update({ archived_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("archived_at", null)
        .lt("last_message_at", cutoff);
      if (error) throw error;
    }

    let conversationsQuery = supabase
      .from("vera_conversations")
      .select("id, title, last_message_at, archived_at, created_at")
      .eq("user_id", userId);
    conversationsQuery = archived
      ? conversationsQuery.not("archived_at", "is", null)
      : conversationsQuery.is("archived_at", null);
    const { data, error } = await conversationsQuery
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ conversations: data ?? [] });
  } catch {
    return NextResponse.json({ error: "No pude cargar el historial de VERA." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "La conversación no es válida." }, { status: 400 });
    }
    const input = body as { id?: unknown; messages?: unknown };
    if (!isMessages(input.messages)) {
      return NextResponse.json({ error: "Los mensajes no tienen un formato válido." }, { status: 400 });
    }

    const firstUserMessage = input.messages.find((message) => message.role === "user")?.content ?? "Nueva conversación";
    const title = firstUserMessage.replace(/\s+/g, " ").trim().slice(0, 64) || "Nueva conversación";
    const now = new Date().toISOString();
    const values = { messages: input.messages, last_message_at: now, updated_at: now, archived_at: null };

    if (typeof input.id === "string" && input.id.length <= 64) {
      const { data, error } = await supabase
        .from("vera_conversations")
        .update(values)
        .eq("id", input.id)
        .eq("user_id", userId)
        .select("id, title, last_message_at, archived_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "No encontré esa conversación." }, { status: 404 });
      return NextResponse.json({ conversation: data });
    }

    const { data, error } = await supabase
      .from("vera_conversations")
      .insert({ ...values, title, user_id: userId })
      .select("id, title, last_message_at, archived_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ conversation: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No pude guardar la conversación." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    const input = body as { id?: unknown; action?: unknown; title?: unknown };
    if (typeof input.id !== "string" || input.id.length > 64) {
      return NextResponse.json({ error: "La conversación no es válida." }, { status: 400 });
    }

    if (input.action === "rename") {
      const title = typeof input.title === "string" ? input.title.replace(/\s+/g, " ").trim() : "";
      if (!title || title.length > 64) {
        return NextResponse.json({ error: "El título debe tener entre 1 y 64 caracteres." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("vera_conversations")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .eq("user_id", userId)
        .select("id, title, last_message_at, archived_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "No encontré esa conversación." }, { status: 404 });
      return NextResponse.json({ conversation: data });
    }

    if (input.action !== "archive" && input.action !== "restore") {
      return NextResponse.json({ error: "La acción no es válida." }, { status: 400 });
    }
    const archivedAt = input.action === "archive" ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from("vera_conversations")
      .update({ archived_at: archivedAt, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("user_id", userId)
      .select("id, archived_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No encontré esa conversación." }, { status: 404 });
    return NextResponse.json({ conversation: data });
  } catch {
    return NextResponse.json({ error: "No pude actualizar esa conversación." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
      return NextResponse.json({ error: "La conversación no es válida." }, { status: 400 });
    }
    const { error } = await supabase
      .from("vera_conversations")
      .delete()
      .eq("id", (body as { id: string }).id)
      .eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "No pude eliminar esa conversación." }, { status: 500 });
  }
}
