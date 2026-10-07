import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import AdminView from "./admin-view";
import { loadAdminData } from "./data";

export const dynamic = "force-dynamic";
// Mesmo título das outras telas (a aba do navegador não revela o painel) e fora do Google.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Quem não está na lista (ou não está logado) recebe "página não encontrada":
  // nem fica sabendo que esta tela existe.
  if (!user || !isAdminEmail(user.email)) notFound();

  const data = await loadAdminData();
  return <AdminView email={user.email!} data={data} />;
}
