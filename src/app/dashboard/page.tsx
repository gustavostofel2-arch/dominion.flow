import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSubscriptionActive, type Subscription } from "@/lib/subscription";
import ActivationForm from "./activation-form";
import SignOutButton from "./sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan, current_period_end, cancel_at_period_end, next_billing_at")
    .eq("user_id", user.id)
    .maybeSingle<Subscription>();

  const active = isSubscriptionActive(sub);
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;
  // Ativa: data da próxima renovação. Cancelada: acesso até esse mesmo dia.
  // Manual (sem Lastlink): data de validade.
  // (next_billing_at = dia da renovação; o acesso vale até o fim desse dia).
  const until = fmt(sub?.next_billing_at) ?? fmt(sub?.current_period_end);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Dominion Flow</h1>
          <p className="truncate text-sm opacity-70">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`rounded-full px-3 py-1 font-medium ${
            active
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:text-zinc-300"
          }`}
        >
          {active ? "Assinatura ativa" : "Assinatura inativa"}
        </span>
        {active && sub?.plan && <span className="opacity-70">Plano: {sub.plan}</span>}
        {active && until && (
          <span className="opacity-70">
            · {sub?.cancel_at_period_end ? "renovação cancelada, acesso até" : sub?.next_billing_at ? "renova em" : "acesso até"}{" "}
            {until}
          </span>
        )}
      </div>

      <ActivationForm initiallyActive={active} checkoutUrl={process.env.NEXT_PUBLIC_CHECKOUT_URL ?? null} />

      <ol className="mt-8 list-decimal space-y-1 pl-5 text-sm opacity-70">
        <li>Abra a ferramenta Dominion Flow no Google Flow e copie o código de sessão.</li>
        <li>Cole aqui e clique em &quot;Gerar ativação&quot;.</li>
        <li>Copie o token e cole de volta na Tool. Ele vale por poucos minutos e só para aquela sessão.</li>
      </ol>
    </main>
  );
}
