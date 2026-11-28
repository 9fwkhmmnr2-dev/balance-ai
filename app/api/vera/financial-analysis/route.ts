import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TERMS_VERSION, PRIVACY_VERSION, VERA_TERMS_VERSION, VERA_PRIVACY_VERSION } from "@/lib/legal-versions";
import { analyzeFinance } from "@/lib/finance-algorithm/engine";
import type {
  FinanceAlgorithmPreferences,
  FinanceCommitmentInput,
  FinanceGoalInput,
  FinanceProfileInput,
  FinancePriority,
  FinanceOperationType,
} from "@/lib/finance-algorithm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedPayFrequencies = ["monthly", "biweekly", "weekly", "daily", "variable", "none", "not_set"] as const;
const allowedPriorities = ["saving", "expense_organization", "debt_management", "cost_reduction", "purchase_planning"] as const;
const allowedOperationTypes = ["saving_plan", "expense_review", "debt_review", "purchase_planning", "price_tracking", "goal_follow_up"] as const;

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 30) : [];
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ error: "El servicio financiero no está configurado." }, { status: 503 });

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

    // VERA remains adult-only. This deterministic endpoint does not send data to an AI provider,
    // so it checks legal eligibility but deliberately does not require AI-processing consent.
    const { data: acceptance, error: acceptanceError } = await supabase
      .from("registration_acceptances")
      .select("age_eligible, terms_version, privacy_version, vera_terms_version, vera_privacy_version")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (acceptanceError) return NextResponse.json({ error: "No pudimos verificar los permisos de VERA." }, { status: 503 });
    if (!acceptance || acceptance.age_eligible !== true) {
      return NextResponse.json({ error: "VERA está disponible únicamente para cuentas cuya persona titular tenga 18 años o más." }, { status: 403 });
    }
    if (acceptance.terms_version !== TERMS_VERSION || acceptance.privacy_version !== PRIVACY_VERSION ||
        acceptance.vera_terms_version !== VERA_TERMS_VERSION || acceptance.vera_privacy_version !== VERA_PRIVACY_VERSION) {
      return NextResponse.json({ error: "Actualizá las aceptaciones legales de VERA desde Configuración." }, { status: 403 });
    }

    const [
      { data: profileRow, error: profileError },
      { data: commitmentRows, error: commitmentError },
      { data: goalRows, error: goalError },
      { data: preferenceRow, error: preferenceError },
    ] = await Promise.all([
      supabase.from("financial_profiles")
        .select("pay_frequency, typical_income, currency, protected_reserve_amount, protected_reserve_currency, expense_categories")
        .eq("user_id", authData.user.id).maybeSingle(),
      supabase.from("financial_commitments")
        .select("id, name, amount, currency, frequency, amount_type, cost_type, is_active")
        .eq("user_id", authData.user.id).eq("is_active", true).limit(200),
      supabase.from("financial_goals")
        .select("id, title, target_amount, currency, target_date, status")
        .eq("user_id", authData.user.id).neq("status", "archived").limit(100),
      supabase.from("finance_algorithm_preferences")
        .select("algorithm_mode, priorities, alert_intensity, operation_types, interests, personalization_enabled, ai_assistance_consent, cross_module_data_consent, adaptive_learning_consent")
        .eq("user_id", authData.user.id).maybeSingle(),
    ]);

    if (profileError || commitmentError || goalError || preferenceError) {
      console.error("[VERA_FINANCIAL_ANALYSIS] read failed", {
        profile: profileError?.code, commitments: commitmentError?.code,
        goals: goalError?.code, preferences: preferenceError?.code,
      });
      return NextResponse.json({ error: "No pudimos leer todos los datos financieros autorizados." }, { status: 503 });
    }

    let profile: FinanceProfileInput | null = null;
    if (profileRow) {
      profile = {
        payFrequency: isOneOf(profileRow.pay_frequency, allowedPayFrequencies) ? profileRow.pay_frequency : "not_set",
        typicalIncome: profileRow.typical_income == null ? null : Number(profileRow.typical_income),
        currency: profileRow.currency,
        protectedReserveAmount: profileRow.protected_reserve_amount == null ? null : Number(profileRow.protected_reserve_amount),
        protectedReserveCurrency: profileRow.protected_reserve_currency,
        expenseCategories: stringArray(profileRow.expense_categories),
      };
    }

    const commitments: FinanceCommitmentInput[] = (commitmentRows ?? []).flatMap((row) => {
      if (!isOneOf(row.frequency, ["weekly", "monthly", "yearly"] as const) ||
          !isOneOf(row.amount_type, ["exact", "approximate"] as const) ||
          !isOneOf(row.cost_type, ["fixed", "variable"] as const)) return [];
      return [{
        id: row.id, name: row.name, amount: Number(row.amount), currency: row.currency,
        frequency: row.frequency, amountType: row.amount_type, costType: row.cost_type, isActive: row.is_active,
      }];
    });

    const goals: FinanceGoalInput[] = (goalRows ?? []).flatMap((row) => {
      if (!isOneOf(row.status, ["active", "paused", "completed", "archived"] as const)) return [];
      return [{
        id: row.id, title: row.title, targetAmount: Number(row.target_amount), currency: row.currency,
        targetDate: row.target_date, status: row.status,
      }];
    });

    let preferences: FinanceAlgorithmPreferences | undefined;
    if (preferenceRow) {
      preferences = {
        mode: isOneOf(preferenceRow.algorithm_mode, ["automatic", "on-demand", "follow-up", "deep"] as const)
          ? preferenceRow.algorithm_mode : "on-demand",
        priorities: stringArray(preferenceRow.priorities).filter((item): item is FinancePriority => isOneOf(item, allowedPriorities)),
        alertIntensity: isOneOf(preferenceRow.alert_intensity, ["important_only", "balanced", "detailed"] as const)
          ? preferenceRow.alert_intensity : "balanced",
        operationTypes: stringArray(preferenceRow.operation_types).filter((item): item is FinanceOperationType => isOneOf(item, allowedOperationTypes)),
        interests: stringArray(preferenceRow.interests),
        personalizationEnabled: preferenceRow.personalization_enabled,
        aiAssistanceConsent: preferenceRow.ai_assistance_consent,
        crossModuleDataConsent: preferenceRow.cross_module_data_consent,
        adaptiveLearningConsent: preferenceRow.adaptive_learning_consent,
      };
    }

    const analysis = analyzeFinance({ profile, commitments, goals, preferences });
    return NextResponse.json({
      analysis,
      source: "finance.track",
      readOnly: true,
      generatedAt: analysis.analyzedAt,
      note: "Análisis determinístico. No modifica datos, no ejecuta operaciones ni envía información a proveedores de IA.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[VERA_FINANCIAL_ANALYSIS] unexpected error", error);
    return NextResponse.json({ error: "No pudimos generar el análisis financiero." }, { status: 500 });
  }
}
