// Verifica um token exatamente como a Tool do Flow faz (Web Crypto + chave pública).
// Serve para conferir se o site está gerando tokens válidos.
//
//   npm run token:verify -- <token> <XXXX-XXXX-XXXX-XXXX> [chavePublicaBase64]
//
// Sem a chave pública no argumento, lê keys/public-key.txt.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [token, challenge, pubArg] = process.argv.slice(2);

if (!token || !challenge) {
  console.error("Uso: npm run token:verify -- <token> <XXXX-XXXX-XXXX-XXXX> [chavePublicaBase64]");
  process.exit(1);
}

const PUBLIC_KEY_BASE64 = (pubArg ?? fs.readFileSync(path.join(root, "keys", "public-key.txt"), "utf8")).trim();

function base64urlToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function verifyToken(token, currentChallenge) {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return { valid: false, reason: "Formato de token inválido." };
  const [versionPrefix, payloadB64, sigB64] = parts;

  const key = await crypto.subtle.importKey("raw", base64urlToBytes(PUBLIC_KEY_BASE64), { name: "Ed25519" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    "Ed25519",
    key,
    base64urlToBytes(sigB64),
    new TextEncoder().encode(`${versionPrefix}.${payloadB64}`),
  );
  if (!ok) return { valid: false, reason: "Assinatura inválida." };

  const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
  if (payload.version !== 1 || payload.toolId !== "flow-space") return { valid: false, reason: "Token não é desta ferramenta.", payload };
  if (payload.challenge !== currentChallenge) return { valid: false, reason: "Este token não pertence a esta sessão.", payload };
  if (payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, reason: "Token expirado.", payload };
  return { valid: true, payload };
}

const result = await verifyToken(token, challenge);
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);
