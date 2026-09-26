# dominion.flow — Licenciamento FlowSpace

Site que gera **tokens de ativação assinados (Ed25519)** para a Tool
"FlowSpace" do Google Flow. O usuário faz login, cola o código de sessão da
Tool, o site confere se a assinatura está ativa no Supabase e devolve um token
que ele cola de volta na Tool. A Tool confere o token **localmente**, com a
chave pública embutida.

```
[Tool no Flow]                         [Este site: Next.js + Supabase]
 gera código de sessão   ── copia ──►   login, confere assinatura ativa,
 (muda a cada abertura)                 assina token com a chave PRIVADA
 confere token com a     ◄── cola ───   (só em variável de ambiente)
 chave PÚBLICA → libera
```

## Estrutura

| Caminho | O que é |
| --- | --- |
| `supabase/schema.sql` | Tabelas `subscriptions` e `activation_logs` + RLS + triggers |
| `src/app/api/generate-token/route.ts` | API que assina o token (runtime Node) |
| `src/lib/token.ts` | Geração do token `v1.<payload>.<assinatura>` |
| `src/app/login`, `src/app/dashboard` | Telas |
| `src/proxy.ts` | Renova sessão do Supabase e protege `/dashboard` |
| `flow-tool/PROMPT-FLOW.md` | Prompt para colar na Tool do Flow (modelo) |
| `scripts/generate-keys.mjs` | Gera o par de chaves Ed25519 localmente |
| `scripts/sign-test-token.mjs` | Gera token de teste sem site/Supabase |
| `scripts/verify-token.mjs` | Verifica um token do mesmo jeito que a Tool |

## Setup

### 1. Dependências
```bash
npm install
```

### 2. Chaves Ed25519 (definitivas)
```bash
npm run keys
```
Gera `keys/private-key.pem`, `keys/public-key.txt`, `keys/PROMPT-FLOW-PRONTO.md`
e grava `FLOW_PRIVATE_KEY_PEM` no `.env.local`. A pasta `keys/` está no
`.gitignore`. **Guarde `keys/private-key.pem` num lugar seguro fora do PC
também** (gerenciador de senhas) — se perder, precisa gerar outra e atualizar
a Tool.

### 3. Supabase
1. Crie um projeto em <https://supabase.com>.
2. **SQL Editor → New query** → cole todo o `supabase/schema.sql` → **Run**.
3. **Project Settings → API Keys**: copie para o `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role / secret key → `SUPABASE_SERVICE_ROLE_KEY`
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (depois troque pela URL da Vercel)
   - Redirect URLs: `http://localhost:3000/auth/callback` e
     `https://SEU-SITE.vercel.app/auth/callback`

> Alternativa pela CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`
> e `npx supabase db query --file supabase/schema.sql` (ou cole no SQL Editor, que é mais simples).

### 4. Rodar
```bash
npm run dev
```
Acesse <http://localhost:3000>, crie uma conta e ative ela no SQL Editor:
```sql
update public.subscriptions s
   set status = 'active', plan = 'mensal', current_period_end = now() + interval '30 days'
  from auth.users u
 where u.id = s.user_id and u.email = 'seu@email.com';
```

### 5. Conferir um token gerado pelo site
```bash
npm run token:verify -- <token> ABCD-EFGH-IJKL-MNOP
```

## Deploy (Vercel)
1. Importe o repositório do GitHub na Vercel.
2. Em **Settings → Environment Variables** cole as 4 variáveis do `.env.local`
   (para `FLOW_PRIVATE_KEY_PEM`, cole o valor **sem as aspas**).
3. Deploy. Atualize Site URL / Redirect URLs no Supabase com a URL final.

## Gerenciar clientes
Veja os comandos prontos no final de `supabase/schema.sql` (ativar, desativar,
listar, detectar quem gera tokens demais).

## Segurança
- `FLOW_PRIVATE_KEY_PEM` e `SUPABASE_SERVICE_ROLE_KEY` só existem no servidor
  (`process.env`, arquivos com `import "server-only"`).
- Token vale 10 min (`FLOW_TOKEN_TTL_SECONDS`) e só para o código de sessão
  exibido naquele momento.
- Limite de 15 tokens por usuário a cada 10 min; tudo registrado em `activation_logs`.
