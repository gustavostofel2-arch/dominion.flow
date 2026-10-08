import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSubscriptionActive, type Subscription } from "@/lib/subscription";
import { isAdminEmail } from "@/lib/admin";
import DashboardView from "./dashboard-view";

export const dynamic = "force-dynamic";

function firstName(name: string | null | undefined, email: string | undefined) {
  const raw = (name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "").toLowerCase();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan, current_period_end, name, billing_period, next_billing_at, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle<Subscription & { name: string | null; billing_period: string | null }>();

  const active = isSubscriptionActive(sub);
  const hello = firstName(sub?.name, user.email);
  // Plano exibido: só o período da compra (Mensal, Trimestral, Semestral, Anual).
  // Contas liberadas à mão (dono, sócios) não têm período e mostram o próprio rótulo.
  const planLabel = sub?.billing_period?.trim() || sub?.plan?.trim() || null;
  // Renovação: data da próxima cobrança na Lastlink (não a data de fim do acesso).
  const renewal = sub?.cancel_at_period_end
    ? "Cancelada"
    : sub?.next_billing_at
      ? new Date(sub.next_billing_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : null;

  return (
    <DashboardView
      email={user.email}
      hello={hello}
      active={active}
      plan={planLabel}
      renewal={renewal}
      checkoutUrl={process.env.NEXT_PUBLIC_CHECKOUT_URL ?? null}
      showAdmin={await isAdminEmail(user.email)}
    />
  );
}
