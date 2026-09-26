// Gera um token de TESTE sem passar pelo site/Supabase, usando keys/private-key.pem.
// Útil para testar a Tool do Flow antes de o site estar no ar.
//
//   npm run token:sign -- ABCD-EFGH-IJKL-MNOP [ttlSegundos]

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [challenge, ttlArg] = process.argv.slice(2);

if (!challenge || !/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(challenge)) {
  console.error("Uso: npm run token:sign -- XXXX-XXXX-XXXX-XXXX [ttlSegundos]");
  process.exit(1);
}

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const privateKey = crypto.createPrivateKey(fs.readFileSync(path.join(root, "keys", "private-key.pem")));
const now = Math.floor(Date.now() / 1000);
const payload = { version: 1, toolId: "flow-space", challenge, iat: now, exp: now + (Number(ttlArg) || 600) };
const signingInput = `v1.${b64url(Buffer.from(JSON.stringify(payload)))}`;
const sig = crypto.sign(null, Buffer.from(signingInput), privateKey);

console.log(`${signingInput}.${b64url(sig)}`);
