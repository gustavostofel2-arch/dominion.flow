import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Cliente com service_role: IGNORA RLS. Só usar no servidor, nunca repassar
 * dados dele ao cliente sem filtrar.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Variável de ambiente ausente: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
