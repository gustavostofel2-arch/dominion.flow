import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionActive, type Subscription } from "@/lib/subscription";
import { generateToken, normalizeChallenge } from "@/lib/token";

// Usa o módulo `crypto` do Node: NUNCA trocar para "edge".
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Limite anti-abuso: máximo de tokens por usuário numa janela de tempo.
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MINUTES = 10;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("status, plan, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle<Subscription>();

  if (subError) {
    console.error("[generate-token] erro ao ler subscription", subError);
    return NextResponse.json({ erro: "Erro ao verificar assinatura" }, { status: 500 });
  }

  if (!isSubscriptionActive(sub)) {
    return NextResponse.json({ erro: "Assinatura inativa" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido" }, { status: 400 });
  }

  const challenge = normalizeChallenge((body as { challenge?: unknown })?.challenge);
  if (!challenge) {
    return NextResponse.json(
      { erro: "Código de sessão inválido. Formato esperado: XXXX-XXXX-XXXX-XXXX" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("activation_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { erro: "Muitas ativações em pouco tempo. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  let result: ReturnType<typeof generateToken>;
  try {
    result = generateToken(challenge);
  } catch (e) {
    console.error("[generate-token] falha ao assinar", e);
    return NextResponse.json({ erro: "Erro interno ao gerar token" }, { status: 500 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { error: logError } = await admin
    .from("activation_logs")
    .insert({ user_id: user.id, challenge, ip });
  if (logError) console.error("[generate-token] falha ao gravar log", logError);

  return NextResponse.json({ token: result.token, exp: result.exp }, { status: 200 });
}
