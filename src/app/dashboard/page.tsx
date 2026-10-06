import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSubscriptionActive, type Subscription } from "@/lib/subscription";
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
    .select("status, plan, current_period_end, cancel_at_period_end, next_billing_at, name, billing_period")
    .eq("user_id", user.id)
    .maybeSingle<Subscription & { name: string | null; billing_period: string | null }>();

  const active = isSubscriptionActive(sub);
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;
  // Ativa: data da próxima renovação. Cancelada: acesso até esse mesmo dia.
  // Manual (sem Lastlink): data de validade.
  // (next_billing_at = dia da renovação; o acesso vale até o fim desse dia).
  const until = fmt(sub?.next_billing_at) ?? fmt(sub?.current_period_end);
  const hello = firstName(sub?.name, user.email);
  const renewLabel = sub?.cancel_at_period_end
    ? "Renovação cancelada · acesso até"
    : sub?.next_billing_at
      ? "Renova em"
      : "Acesso até";
  // Plano exibido: nome da oferta + período (ex.: "Dominion · Anual"). O período só aparece
  // em assinaturas com renovação (contas liberadas à mão, como sócios, mostram só o rótulo).
  const offer = sub?.plan?.trim() || null;
  const period = sub?.next_billing_at ? sub?.billing_period : null;
  const planLabel = offer && period ? `${offer} · ${period}` : (period ?? offer);

  return (
    <DashboardView
      email={user.email}
      hello={hello}
      active={active}
      until={until}
      renewLabel={renewLabel}
      plan={planLabel}
      checkoutUrl={process.env.NEXT_PUBLIC_CHECKOUT_URL ?? null}
    />
  );
}
