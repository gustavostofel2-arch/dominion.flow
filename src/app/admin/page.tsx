import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import AdminView from "./admin-view";
import { loadAffiliateSales } from "./affiliates";
import { loadAdminData } from "./data";

export const dynamic = "force-dynamic";
// Envio de e-mails em lote (até 40, ~2 por segundo) precisa de mais tempo que o padrão.
export const maxDuration = 60;
// Mesmo título das outras telas (a aba do navegador não revela o painel) e fora do Google.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Quem não está na lista (ou não está logado) recebe "página não encontrada":
  // nem fica sabendo que esta tela existe.
  if (!user || !(await isAdminEmail(user.email))) notFound();

  const [data, affiliateSales] = await Promise.all([
    loadAdminData(),
    // Se a leitura dos afiliados falhar, o resto do painel continua funcionando.
    loadAffiliateSales().catch(() => []),
  ]);
  return <AdminView data={data} affiliateSales={affiliateSales} />;
}
