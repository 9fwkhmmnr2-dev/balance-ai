import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseClientInstance = SupabaseClient<any, "public">;

let client: SupabaseClientInstance | null = null;

function getSupabaseClient(): SupabaseClientInstance {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  client = createClient<any>(supabaseUrl, supabaseKey);
  return client;
}

// La instancia se crea al usar Supabase, no al importar el módulo.
// Esto evita que Next.js falle durante el prerender si las variables
// todavía no están disponibles en el entorno de compilación.
export const supabase = new Proxy({} as SupabaseClientInstance, {
  get(_target, property) {
    const instance = getSupabaseClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
