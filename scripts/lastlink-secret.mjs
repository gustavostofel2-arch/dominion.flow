// Gera o segredo da URL do webhook da Lastlink e grava no .env.local.
// Não imprime o segredo: ele fica em .env.local e em keys/lastlink-webhook.txt.
//
//   npm run lastlink:secret            → gera (se ainda não existir)
//   npm run lastlink:secret -- --force → gera outro (atualize a Vercel e a Lastlink!)

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env.local");
const outPath = path.join(root, "keys", "lastlink-webhook.txt");
const force = process.argv.includes("--force");

let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const current = env.match(/^LASTLINK_WEBHOOK_SECRET=(.+)$/m)?.[1]?.trim();
if (current && !force) {
  console.error("LASTLINK_WEBHOOK_SECRET já existe no .env.local. Para trocar: npm run lastlink:secret -- --force");
  process.exit(1);
}

const secret = crypto.randomBytes(24).toString("base64url");
const line = `LASTLINK_WEBHOOK_SECRET=${secret}`;
env = /^LASTLINK_WEBHOOK_SECRET=.*$/m.test(env)
  ? env.replace(/^LASTLINK_WEBHOOK_SECRET=.*$/m, () => line)
  : env.replace(/\n?$/, "\n") + line + "\n";
fs.writeFileSync(envPath, env);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  [
    "VARIÁVEL DA VERCEL",
    `  LASTLINK_WEBHOOK_SECRET = ${secret}`,
    "",
    "URL PARA COLAR NA LASTLINK (troque SEU-SITE pela URL da Vercel)",
    `  https://SEU-SITE.vercel.app/api/webhooks/lastlink?key=${secret}`,
    "",
    "Não compartilhe este arquivo.",
    "",
  ].join("\n"),
);

console.log("✔ Segredo gerado e gravado no .env.local");
console.log("✔ Abra keys/lastlink-webhook.txt para ver a variável da Vercel e a URL da Lastlink");
