import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Recebe os avisos (webhooks) da Lastlink e atualiza a tabela subscriptions.
// Toda a regra de negócio fica na função SQL public.process_lastlink_event
// (supabase/schema.sql), que roda numa transação só.
//
// URL para cadastrar na Lastlink:
//   https://SEU-SITE.vercel.app/api/webhooks/lastlink?key=<LASTLINK_WEBHOOK_SECRET>

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const intEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export async function POST(request: NextRequest) {
  const secret = process.env.LASTLINK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[lastlink] LASTLINK_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ ok: false, erro: "Webhook não configurado" }, { status: 500 });
  }

  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!safeEqual(key, secret)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ ok: false, erro: "JSON inválido" }, { status: 400 });
  }
  if (!payload || typeof payload.Id !== "string" || typeof payload.Event !== "string") {
    return NextResponse.json({ ok: false, erro: "Payload sem Id ou Event" }, { status: 400 });
  }

  // A documentação da Lastlink não diz onde ela envia o token da integração.
  // Registramos se ele apareceu (e em quais cabeçalhos), sem guardar valores,
  // para poder exigir o token depois com LASTLINK_REQUIRE_TOKEN=true.
  const lastlinkToken = process.env.LASTLINK_TOKEN?.trim();
  const headerNames = [...request.headers.keys()];
  let tokenMatched: boolean | null = null;
  if (lastlinkToken) {
    tokenMatched =
      [...request.headers.values()].some((v) => v.includes(lastlinkToken)) ||
      (typeof payload.Token === "string" && payload.Token === lastlinkToken);
    if (!tokenMatched && process.env.LASTLINK_REQUIRE_TOKEN === "true") {
      return NextResponse.json({ ok: false, erro: "Token da Lastlink inválido" }, { status: 401 });
    }
  }

  const productIds = (process.env.LASTLINK_PRODUCT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const options = {
    access_months: intEnv("LASTLINK_PERIOD_MONTHS", 1),
    grace_days: intEnv("LASTLINK_GRACE_DAYS", 3),
    apply_test: process.env.LASTLINK_APPLY_TEST_EVENTS === "true",
    product_ids: productIds,
    meta: { header_names: headerNames, lastlink_token_matched: tokenMatched },
  };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("process_lastlink_event", {
    p_payload: payload,
    p_options: options,
  });

  if (error) {
    // Erro → nada foi gravado. Respondemos 500 para a Lastlink tentar de novo.
    console.error("[lastlink] falha ao processar", payload.Event, payload.Id, error);
    return NextResponse.json({ ok: false, erro: "Falha ao processar" }, { status: 500 });
  }

  console.log("[lastlink]", payload.Event, payload.Id, data);
  return NextResponse.json({ ok: true, result: (data as { result?: string } | null)?.result ?? null });
}

export function GET() {
  return NextResponse.json({ ok: false, erro: "Use POST" }, { status: 405 });
}
