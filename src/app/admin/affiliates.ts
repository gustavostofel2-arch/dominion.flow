import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll, fmtDateTime } from "./data";

// Vendas feitas por afiliados (Lastlink). Só LÊ o banco.
// O aviso traz o afiliado em Data.Purchase.Affiliate {Id, Name, Email, CommissionPercent}
// e o valor da comissão em Data.Commissions (Source = "AFFILIATE").

export type AffiliateSale = {
  id: string;
  at: string;
  when: string;
  affKey: string;
  affName: string | null;
  affEmail: string | null;
  pct: number | null;
  /** Valor da venda (preço da oferta, sem juros de parcelamento). */
  value: number;
  /** Comissão do afiliado nesta venda. */
  commission: number;
  renewal: boolean;
  /** Período da cobrança: Mensal, Trimestral, Semestral, Anual ou Vitalício. */
  period: string;
  /** Esta cobrança foi a última antes de um reembolso/chargeback do cliente. */
  refunded: boolean;
  buyer: string | null;
  offer: string | null;
};

type Row = {
  id: string;
  email: string | null;
  result: string;
  is_test: boolean;
  received_at: string;
  original: string | null;
  amount: string | null;
  renewal: string | null;
  aff: unknown;
  commissions: unknown;
  offer: string | null;
  plan: string | null;
  next: string | null;
  paid: string | null;
};

const NOT_COUNTED = new Set(["test_ignored", "ignored_other_product", "no_email", "processing", "stale_ignored", "duplicate"]);

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Datas da Lastlink vêm em UTC, às vezes sem "Z". */
function ts(v: string | null) {
  if (!v) return null;
  const t = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(v) ? v : v + "Z").getTime();
  return Number.isFinite(t) ? t : null;
}

/** Mensal, Trimestral, Anual... pela distância entre o pagamento e a próxima cobrança (igual ao resto do sistema). */
function periodOf(r: Row) {
  if (r.offer && /vital/i.test(r.offer)) return "Vitalício";
  const next = ts(r.next);
  const paid = ts(r.paid) ?? new Date(r.received_at).getTime();
  if (next !== null && next > paid) {
    const months = Math.round((next - paid) / 86_400_000 / 30.4375);
    if (months === 1) return "Mensal";
    if (months === 2) return "Bimestral";
    if (months === 3) return "Trimestral";
    if (months === 6) return "Semestral";
    if (months === 12) return "Anual";
    if (months > 0) return `${months} meses`;
  }
  return r.plan?.trim() || (next === null ? "Vitalício" : "Outro");
}

export async function loadAffiliateSales(): Promise<AffiliateSale[]> {
  const admin = createAdminClient();

  const [rows, subs] = await Promise.all([
    fetchAll<Row>((from, to) =>
      admin
        .from("webhook_events")
        .select(
          "id, email, result, is_test, received_at, original:payload->Data->Purchase->OriginalPrice->>Value, amount:payload->Data->Purchase->Price->>Value, renewal:payload->Data->Purchase->>IsRenewal, aff:payload->Data->Purchase->Affiliate, commissions:payload->Data->Commissions, offer:payload->Data->Offer->>Name, plan:payload->Data->Plan->>Name, next:payload->Data->Purchase->>NextBilling, paid:payload->Data->Purchase->>PaymentDate",
        )
        .in("event", ["Purchase_Order_Confirmed", "Recurrent_Payment"])
        .order("received_at", { ascending: false })
        .range(from, to),
    ),
    fetchAll<{ email: string; refunded_at: string | null; chargeback_at: string | null }>((from, to) =>
      admin
        .from("subscriptions")
        .select("email, refunded_at, chargeback_at")
        .or("refunded_at.not.is.null,chargeback_at.not.is.null")
        .range(from, to),
    ),
  ]);

  const valid = rows.filter((r) => !r.is_test && !NOT_COUNTED.has(r.result));

  // Reembolso/chargeback: marca a última cobrança do cliente feita até aquele momento.
  const byEmail = new Map<string, Row[]>();
  for (const r of valid) {
    if (!r.email) continue;
    const list = byEmail.get(r.email) ?? [];
    list.push(r);
    byEmail.set(r.email, list);
  }
  const refunded = new Set<string>();
  for (const s of subs) {
    const list = byEmail.get(s.email);
    if (!list) continue;
    for (const when of [s.refunded_at, s.chargeback_at]) {
      if (!when) continue;
      const limit = new Date(when).getTime() + 60_000;
      let best: Row | null = null;
      for (const r of list) {
        const t = new Date(r.received_at).getTime();
        if (t <= limit && (!best || t > new Date(best.received_at).getTime())) best = r;
      }
      if (best) refunded.add(best.id);
    }
  }

  const out: AffiliateSale[] = [];
  for (const r of valid) {
    if (!r.aff || typeof r.aff !== "object" || Array.isArray(r.aff)) continue;
    const a = r.aff as { Id?: unknown; Name?: unknown; Email?: unknown; CommissionPercent?: unknown };
    const affId = str(a.Id);
    const affEmail = str(a.Email)?.toLowerCase() ?? null;
    const affKey = affId ?? affEmail;
    if (!affKey) continue;

    const value = num(r.original) ?? num(r.amount) ?? 0;
    const pct = num(a.CommissionPercent);
    const list = Array.isArray(r.commissions) ? (r.commissions as { Source?: unknown; Value?: unknown }[]) : [];
    const fromList = list.find((c) => c && c.Source === "AFFILIATE");
    const commission = num(fromList?.Value) ?? (pct !== null ? Math.round(value * pct) / 100 : 0);

    out.push({
      id: r.id,
      at: r.received_at,
      when: fmtDateTime(r.received_at) ?? "",
      affKey,
      affName: str(a.Name),
      affEmail,
      pct,
      value,
      commission,
      renewal: r.renewal === "true",
      period: periodOf(r),
      refunded: refunded.has(r.id),
      buyer: r.email,
      offer: r.offer,
    });
  }
  return out;
}
