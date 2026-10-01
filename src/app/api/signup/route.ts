import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionActive, type Subscription } from "@/lib/subscription";

// "Criar acesso": só cria conta para email com assinatura ativa (vinda da Lastlink).
// O cadastro público do Supabase fica DESLIGADO; a conta é criada aqui, já
// confirmada, sem enviar email.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ erro: "Informe um e-mail válido." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ erro: "A senha precisa ter entre 8 e 72 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .select("status, plan, current_period_end, user_id")
    .eq("email", email)
    .maybeSingle<Subscription & { user_id: string | null }>();

  if (subError) {
    console.error("[signup] erro ao ler subscription", subError);
    return NextResponse.json({ erro: "Erro ao verificar assinatura. Tente novamente." }, { status: 500 });
  }

  if (sub?.user_id) {
    return NextResponse.json({ erro: "Este e-mail já tem acesso criado. Use \"Entrar\"." }, { status: 409 });
  }

  if (!isSubscriptionActive(sub)) {
    return NextResponse.json(
      {
        erro:
          "Não encontramos uma assinatura ativa para este e-mail. Use o mesmo e-mail da compra. " +
          "Se acabou de comprar, aguarde 1 minuto e tente de novo.",
      },
      { status: 403 },
    );
  }

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return NextResponse.json({ erro: "Este e-mail já tem acesso criado. Use \"Entrar\"." }, { status: 409 });
    }
    console.error("[signup] erro ao criar usuário", error);
    return NextResponse.json({ erro: "Não foi possível criar o acesso. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
