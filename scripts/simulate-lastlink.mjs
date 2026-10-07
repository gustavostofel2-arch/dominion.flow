// Simula avisos da Lastlink (no formato exato da documentação) contra o site.
// Usa LASTLINK_WEBHOOK_SECRET do .env.local. Os avisos vão como evento REAL
// (IsTest=false), para exercitar o fluxo completo — use um e-mail de teste.
//
//   npm run lastlink:sim -- <url-do-site> <evento> <email> [subscriptionId]
//
// Eventos: compra | renovacao | pendente | cancelamento | expirou | reembolso | chargeback | vitalicio | semkey
// (vitalicio = compra de pagamento único: sem próxima cobrança e sem assinatura)
// Exemplo: npm run lastlink:sim -- https://dominion-flow.vercel.app compra teste1@exemplo.com

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [site, kind, email, subArg] = process.argv.slice(2);
const EVENTS = {
  compra: "Purchase_Order_Confirmed",
  renovacao: "Recurrent_Payment",
  pendente: "Subscription_Renewal_Pending",
  cancelamento: "Subscription_Canceled",
  expirou: "Subscription_Expired",
  reembolso: "Payment_Refund",
  chargeback: "Payment_Chargeback",
  semkey: "Purchase_Order_Confirmed",
  vitalicio: "Purchase_Order_Confirmed",
};

if (!site || !EVENTS[kind] || !email) {
  console.error("Uso: npm run lastlink:sim -- <url-do-site> <" + Object.keys(EVENTS).join("|") + "> <email> [subscriptionId]");
  process.exit(1);
}

const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const secret = env.match(/^LASTLINK_WEBHOOK_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) {
  console.error("LASTLINK_WEBHOOK_SECRET não está no .env.local (rode npm run lastlink:secret).");
  process.exit(1);
}

const now = new Date();
const createdAt = now.toISOString().replace(/\.\d+Z$/, ""); // Lastlink manda sem "Z"
const subscriptionId = subArg || "sim-" + crypto.createHash("sha1").update(email).digest("hex").slice(0, 12);
const event = EVENTS[kind];

const payload = {
  Id: crypto.randomUUID(),
  IsTest: false,
  Event: event,
  CreatedAt: createdAt,
  Data: {
    Products: [{ Id: "sim-produto", Name: "Dominion Flow (simulação)", Price: 97.0 }],
    Buyer: {
      Id: "sim-buyer",
      Email: email,
      Name: "Cliente Simulado",
      PhoneNumber: "+5511999990000",
      Document: "000.000.000-00",
      Address: { City: "São Paulo", State: "SP" },
    },
    Purchase: {
      PaymentId: crypto.randomUUID(),
      Recurrency: kind === "renovacao" ? 2 : 1,
      PaymentDate: now.toISOString(),
      ChargebackDate: kind === "chargeback" ? now.toISOString() : null,
      Price: { Value: 97.0 },
      Payment: { NumberOfInstallments: 1, PaymentMethod: "pix" },
    },
    Subscriptions: [
      {
        Id: subscriptionId,
        ProductId: "sim-produto",
        ...(kind === "cancelamento" ? { CanceledDate: now.toISOString(), CancellationReason: "Simulação" } : {}),
        ...(kind === "expirou" ? { ExpiredDate: now.toISOString() } : {}),
      },
    ],
    Offer: { Id: "sim-oferta", Name: "Dominion Flow Mensal (simulação)", Url: "https://lastlink.com/p/SIM" },
  },
};

if (kind === "vitalicio" || (kind === "reembolso" && process.argv.includes("--vitalicio"))) {
  delete payload.Data.Subscriptions;
  payload.Data.Offer = { Id: "sim-oferta-vitalicia", Name: "Dominion Flow [VITALICIO] (simulação)" };
}

const url = `${site.replace(/\/+$/, "")}/api/webhooks/lastlink` + (kind === "semkey" ? "?key=errada" : `?key=${secret}`);
const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
const text = await res.text();

console.log(`${event} → HTTP ${res.status} ${text}`);
if (kind === "semkey") {
  console.log(res.status === 401 ? "✔ Aviso sem o segredo foi RECUSADO (correto)." : "✖ ATENÇÃO: aviso sem segredo não foi recusado!");
}
