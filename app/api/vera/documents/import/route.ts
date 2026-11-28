import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFinancePlanAccess } from "@/lib/server/gold-access";
import { checkVeraAiEligibility } from "@/lib/server/vera-ai-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RowInput = {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: "income" | "expense";
  category: string;
  accountId: string;
  allowPossibleDuplicate: boolean;
};

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ error: "Servicio financiero no configurado." }, { status: 503 });

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

    // El guardado también debe respetar la elegibilidad legal y de edad de VERA.
    const eligibility = await checkVeraAiEligibility(supabase, authData.user.id);
    if (!eligibility.allowed) return NextResponse.json({ error: eligibility.error }, { status: eligibility.status });

    // Usamos la misma fuente de verdad de FINANCE PLUS que el endpoint de análisis.
    let planAccess: Awaited<ReturnType<typeof getFinancePlanAccess>>;
    try {
      planAccess = await getFinancePlanAccess(supabase, authData.user.id);
    } catch {
      return NextResponse.json({ error: "No pudimos verificar tu plan. Intentá nuevamente." }, { status: 503 });
    }
    if (!planAccess.isPlus) {
      return NextResponse.json({ error: "La importación de documentos requiere FINANCE PLUS." }, { status: 403 });
    }

    const body = await request.json() as { transactions?: unknown };
    if (!Array.isArray(body.transactions) || body.transactions.length < 1 || body.transactions.length > 200) {
      return NextResponse.json({ error: "Seleccioná entre 1 y 200 movimientos para importar." }, { status: 400 });
    }

    const rows: RowInput[] = [];
    for (const raw of body.transactions) {
      if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Hay movimientos con datos inválidos." }, { status: 400 });
      const row = raw as Record<string, unknown>;
      if (typeof row.date !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(row.date) ||
          typeof row.description !== "string" || !row.description.trim() || row.description.length > 180 ||
          typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount <= 0 ||
          typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency) ||
          (row.type !== "income" && row.type !== "expense") ||
          typeof row.category !== "string" || !row.category.trim() ||
          typeof row.accountId !== "string" || typeof row.allowPossibleDuplicate !== "boolean") {
        return NextResponse.json({ error: "Hay movimientos con datos inválidos. Revisalos e intentá nuevamente." }, { status: 400 });
      }
      rows.push({
        date: row.date,
        description: row.description.trim(),
        amount: Math.round(row.amount * 100) / 100,
        currency: row.currency,
        type: row.type,
        category: row.category.trim().slice(0, 60),
        accountId: row.accountId,
        allowPossibleDuplicate: row.allowPossibleDuplicate,
      });
    }

    const accountIds = Array.from(new Set(rows.map((row) => row.accountId)));
    const { data: accounts, error: accountError } = await supabase
      .from("financial_accounts")
      .select("id, currency")
      .eq("user_id", authData.user.id)
      .eq("is_archived", false)
      .in("id", accountIds);
    if (accountError) throw accountError;

    const accountMap = new Map((accounts ?? []).map((account) => [account.id, account.currency]));
    if (rows.some((row) => accountMap.get(row.accountId) !== row.currency)) {
      return NextResponse.json({ error: "Una o más cuentas no pertenecen a tu usuario o usan otra moneda." }, { status: 400 });
    }

    const dates = rows.map((row) => row.date).sort();
    const { data: existing, error: existingError } = await supabase
      .from("movements")
      .select("movement_date, amount, currency, type")
      .eq("user_id", authData.user.id)
      .gte("movement_date", dates[0])
      .lte("movement_date", dates[dates.length - 1])
      .limit(5000);
    if (existingError) throw existingError;

    const fresh = rows.filter((row) => row.allowPossibleDuplicate || !(existing ?? []).some((saved) =>
      saved.movement_date === row.date &&
      saved.currency === row.currency &&
      saved.type === row.type &&
      Math.abs(Number(saved.amount) - row.amount) < 0.01
    ));

    if (!fresh.length) {
      return NextResponse.json({ imported: 0, skippedDuplicates: rows.length, message: "Todos los movimientos seleccionados ya parecen existir." });
    }

    const { error: insertError } = await supabase.from("movements").insert(
      fresh.map((row) => ({
        user_id: authData.user.id,
        description: row.description,
        type: row.type,
        amount: row.amount,
        currency: row.currency,
        category: row.category,
        movement_date: row.date,
        account_id: row.accountId,
      }))
    );
    if (insertError) throw insertError;

    return NextResponse.json({
      imported: fresh.length,
      skippedDuplicates: rows.length - fresh.length,
      message: `Se importaron ${fresh.length} movimientos.`,
    });
  } catch (error) {
    console.error("[VERA_DOCUMENT_IMPORT]", { code: error instanceof Error ? error.message.slice(0, 80) : "UNKNOWN" });
    return NextResponse.json({ error: "No pudimos importar los movimientos. No se guardaron datos parcialmente." }, { status: 500 });
  }
}
