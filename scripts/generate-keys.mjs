// Gera o par de chaves Ed25519 definitivo, LOCALMENTE.
//
//   npm run keys            → gera (se ainda não existir)
//   npm run keys -- --force → gera de novo (invalida a chave pública antiga na Tool!)
//
// Saídas (tudo em ./keys, que está no .gitignore):
//   keys/private-key.pem        → chave privada. NUNCA compartilhe, nunca cole em chat.
//   keys/public-key.txt         → chave pública (base64, 32 bytes). Pode ser pública.
//   keys/PROMPT-FLOW-PRONTO.md  → prompt da Tool com a chave pública já preenchida.
// E grava FLOW_PRIVATE_KEY_PEM no .env.local (criando a partir do exemplo se preciso).
//
// A chave privada NÃO é impressa no terminal de propósito.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const keysDir = path.join(root, "keys");
const privPath = path.join(keysDir, "private-key.pem");
const pubPath = path.join(keysDir, "public-key.txt");
const promptSrc = path.join(root, "flow-tool", "PROMPT-FLOW.md");
const promptOut = path.join(keysDir, "PROMPT-FLOW-PRONTO.md");
const envPath = path.join(root, ".env.local");
const envExample = path.join(root, ".env.local.example");

const force = process.argv.includes("--force");

if (fs.existsSync(privPath) && !force) {
  console.error(
    "Já existe keys/private-key.pem. Não vou sobrescrever.\n" +
      "Se quer MESMO trocar a chave (e atualizar a Tool no Flow), rode: npm run keys -- --force",
  );
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
// JWK "x" = os 32 bytes crus da chave pública em base64url → converte p/ base64 padrão.
const pubB64 = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url").toString("base64");

fs.mkdirSync(keysDir, { recursive: true });
fs.writeFileSync(privPath, privPem, { mode: 0o600 });
fs.writeFileSync(pubPath, pubB64 + "\n");

// Remove o cabeçalho de instruções (tudo até a primeira linha "---"): o arquivo pronto é só o prompt.
const prompt = fs
  .readFileSync(promptSrc, "utf8")
  .replace(/^[\s\S]*?\n---\r?\n+/, "")
  .replaceAll("__PUBLIC_KEY_BASE64__", pubB64);
fs.writeFileSync(promptOut, prompt);

// Atualiza/insere FLOW_PRIVATE_KEY_PEM no .env.local em uma linha só.
const oneLine = privPem.trim().replace(/\r?\n/g, "\\n");
const envLine = `FLOW_PRIVATE_KEY_PEM="${oneLine}"`;
let env = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8")
  : fs.existsSync(envExample)
    ? fs.readFileSync(envExample, "utf8")
    : "";
env = /^FLOW_PRIVATE_KEY_PEM=.*$/m.test(env)
  ? env.replace(/^FLOW_PRIVATE_KEY_PEM=.*$/m, () => envLine)
  : env.replace(/\n?$/, "\n") + envLine + "\n";
fs.writeFileSync(envPath, env);

console.log("✔ Par de chaves Ed25519 gerado.\n");
console.log("Chave PÚBLICA (vai na Tool do Flow, pode ficar exposta):");
console.log("  " + pubB64 + "\n");
console.log("✔ keys/private-key.pem salvo (NUNCA compartilhe).");
console.log("✔ FLOW_PRIVATE_KEY_PEM gravado no .env.local.");
console.log("✔ Prompt pronto para o Flow: keys/PROMPT-FLOW-PRONTO.md");
