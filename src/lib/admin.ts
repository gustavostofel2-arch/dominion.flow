import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Quem enxerga o painel administrativo (/admin): e-mails da tabela admin_users no banco.
// Para incluir alguém: insert into public.admin_users (email) values ('novo@email.com');
// A mesma tabela decide quem escuta o tempo real do painel (regra do banco).
// Enquanto a tabela não existir (SQL ainda não rodado), vale a lista abaixo / ADMIN_EMAILS.
const DEFAULT_ADMIN_EMAILS = ["gustavostofel21@gmail.com", "higormachado.designer@gmail.com"];

function fallbackEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const { data, error } = await createAdminClient().from("admin_users").select("email").eq("email", e).maybeSingle();
  if (!error) return !!data;
  return fallbackEmails().includes(e);
}
