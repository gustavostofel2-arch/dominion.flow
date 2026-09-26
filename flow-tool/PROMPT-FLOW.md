# Prompt para colar na Tool do Google Flow

> Não use este arquivo direto: rode `npm run keys` e use o
> `keys/PROMPT-FLOW-PRONTO.md`, que já vem com a SUA chave pública no lugar de
> `__PUBLIC_KEY_BASE64__`.

---

Quero adicionar um sistema de ativação por token à minha Tool. Implemente:

1. Ao carregar a Tool, gere um código de sessão aleatório em memória usando
   crypto.getRandomValues (formato XXXX-XXXX-XXXX-XXXX, use caracteres A-Z e
   0-9). Mostre esse código bem visível na tela, com um botão "Copiar código".
   Nunca salve esse código em localStorage, sessionStorage ou IndexedDB.

2. Um campo de texto "Cole seu token de ativação aqui" e um botão "Ativar".
   Abaixo, um link/texto: "Gere seu token em https://SEU-SITE.vercel.app".

3. Ao clicar em Ativar, rode esta função de verificação exatamente como está
   (roda 100% local, sem chamada de rede):

```js
const PUBLIC_KEY_BASE64 = '__PUBLIC_KEY_BASE64__';
const EXPECTED_TOOL_ID = 'flow-space';

function base64urlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importPublicKey() {
  const raw = base64urlToBytes(
    PUBLIC_KEY_BASE64.replace(/\+/g, '-').replace(/\//g, '_')
  );
  return crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
}

async function verifyToken(token, currentFlowChallengeCode) {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Formato de token inválido.' };
    }
    const [versionPrefix, payloadB64, sigB64] = parts;
    if (versionPrefix !== 'v1' || !payloadB64 || !sigB64) {
      return { valid: false, reason: 'Formato de token inválido.' };
    }

    // 1) Assinatura primeiro: nada do payload é confiável antes disso.
    const publicKey = await importPublicKey();
    const signingInput = new TextEncoder().encode(`${versionPrefix}.${payloadB64}`);
    const signature = base64urlToBytes(sigB64);
    const isValid = await crypto.subtle.verify('Ed25519', publicKey, signature, signingInput);
    if (!isValid) return { valid: false, reason: 'Assinatura inválida.' };

    // 2) Conteúdo.
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (payload.version !== 1 || payload.toolId !== EXPECTED_TOOL_ID) {
      return { valid: false, reason: 'Token não é desta ferramenta.' };
    }
    if (payload.challenge !== currentFlowChallengeCode) {
      return { valid: false, reason: 'Este token não pertence a esta sessão.' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      return { valid: false, reason: 'Token expirado, gere um novo no site.' };
    }
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, reason: 'Erro ao processar o token.' };
  }
}
```

4. Chame `await verifyToken(tokenColado, codigoDeSessaoGeradoNoPasso1)`.
   Se `resultado.valid` for true, esconda a tela de ativação e libere o resto
   da ferramenta normalmente. Se for false, mostre `resultado.reason` como
   mensagem de erro.

5. Enquanto não estiver ativado, NENHUMA função principal da ferramenta pode
   rodar (nem por botão, nem por atalho). A tela de ativação deve cobrir tudo.
