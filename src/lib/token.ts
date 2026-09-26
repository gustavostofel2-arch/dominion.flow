import "server-only";
import crypto from "node:crypto";

// Formato do código de sessão gerado pela Tool: XXXX-XXXX-XXXX-XXXX (A-Z, 0-9).
export const CHALLENGE_REGEX = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/;

export function normalizeChallenge(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toUpperCase();
  return CHALLENGE_REGEX.test(value) ? value : null;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedKey: crypto.KeyObject | null = null;

/**
 * Reconstrói um PEM limpo a partir do que foi colado no painel (Vercel, .env):
 * tolera aspas, espaços sobrando, \n literal, CRLF e tudo numa linha só.
 */
export function normalizePem(raw: string): string {
  const value = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
  const match = value.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (!match) return value;
  const body = match[1].replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

function getPrivateKey(): crypto.KeyObject {
  if (cachedKey) return cachedKey;

  const pem = process.env.FLOW_PRIVATE_KEY_PEM;
  if (!pem) throw new Error("Variável de ambiente ausente: FLOW_PRIVATE_KEY_PEM");

  const key = crypto.createPrivateKey(normalizePem(pem));
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`FLOW_PRIVATE_KEY_PEM precisa ser Ed25519 (recebido: ${key.asymmetricKeyType})`);
  }
  cachedKey = key;
  return key;
}

export const DEFAULT_TTL_SECONDS = Number(process.env.FLOW_TOKEN_TTL_SECONDS) || 600;

/**
 * Gera o token `v1.<payload>.<assinatura>` exatamente no formato que a Tool
 * do Flow verifica. NÃO altere o formato nem o algoritmo sem mudar a Tool junto.
 */
export function generateToken(
  flowChallengeCode: string,
  { ttlSeconds = DEFAULT_TTL_SECONDS, toolId = "flow-space" } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  const VERSION_PREFIX = "v1";

  const payload = {
    version: 1,
    toolId,
    challenge: flowChallengeCode,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${VERSION_PREFIX}.${payloadB64}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), getPrivateKey());

  return { token: `${signingInput}.${base64url(signature)}`, exp: payload.exp };
}
