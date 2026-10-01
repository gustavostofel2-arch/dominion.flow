# Dominion Flow — Documento de contexto do sistema de ativação

> Guarde este documento. Ele explica **tudo que foi feito** no sistema de liberação
> de acesso da Tool do Google Flow: chaves, tokens, banco, site e prompts.
> Use para diagnosticar e corrigir erros.
>
> ⚠️ Este arquivo **não contém nenhum segredo**. Ele só diz **onde** cada segredo
> está guardado. Nunca cole a chave privada nem a `service_role` em chat, email
> ou documento.

Última atualização: 01/10/2026

---

## 1. O que é o sistema (em uma frase)

A Tool **Dominion Flow** (Google Flow) só libera o uso depois que o cliente cola um
**token de ativação** gerado no **site de ativação** (Vercel + Supabase). O site só
gera o token se a **assinatura do cliente estiver ativa** no banco.

## 2. Por que foi feito assim

O Google Flow impõe limites que obrigam este desenho:

| Limite do Flow | Consequência |
|---|---|
| A Tool não pode chamar nenhum servidor (só CDNs da lista branca) | A Tool não consulta o banco. O cliente faz a ponte copiando e colando. |
| Nada fica salvo entre sessões | Toda vez que a Tool abre, pede ativação de novo. |
| O código da Tool é 100% visível (DevTools / aba Code) | Nenhum segredo pode ficar na Tool. Só a chave **pública**. |
| `navigator.clipboard` bloqueado | Botão "Copiar" usa fallback (seleciona o texto + `execCommand`). |
| Links `target="_blank"` bloqueados | Nenhum link na tela de ativação, só texto. |
| `crypto.subtle` com Ed25519 funciona | A verificação do token roda 100% dentro da Tool. |

O sistema antigo de tokens foi perdido junto com a chave privada (setembro/2026).
Este é um sistema **novo, do zero**, com chaves novas.

## 3. Fluxo completo

```
 [Tool Dominion Flow]                         [Site de ativação — Vercel]
 1. Ao abrir, gera código de sessão           3. Cliente faz login (Supabase Auth)
    XXXX-XXXX-XXXX-XXXX (só em memória)  ──►  4. Cola o código → "Gerar ativação"
                                              5. Site confere assinatura ativa
                                              6. Assina o token com a CHAVE PRIVADA
 8. Cliente cola o token → "Ativar"      ◄──  7. Mostra o token (vale 10 min)
 9. Tool confere com a CHAVE PÚBLICA:
    assinatura → toolId → código → validade
10. Tudo ok → libera a ferramenta até
    fechar/recarregar a Tool
```

## 4. Chaves (o mais importante)

O sistema usa **um par de chaves Ed25519**, gerado em 26/09/2026 na máquina do
Gustavo com `npm run keys` (nunca passou por chat).

| Chave | Para que serve | Onde está | Pode ser pública? |
|---|---|---|---|
| **Privada** | Assina (cria) tokens | `dominion.flow/keys/private-key.pem` (fora do git) **e** variável `FLOW_PRIVATE_KEY_PEM` na Vercel **e** no `.env.local` | ❌ **NUNCA** |
| **Pública** | Confere tokens | Dentro da Tool do Flow (constante `PUBLIC_KEY_BASE64`) e em `keys/public-key.txt` | ✅ Sim |

**Chave pública atual:**
```
rjlo/LSRo6F5AAk9Y4TgCXLvGzOyj26xECwyfL9ejQQ=
```

As duas formam um par: um token assinado pela privada só passa na pública
correspondente. **Se uma for trocada sem a outra, todos os tokens passam a dar
"Assinatura inválida."**

### Backup
Faça uma cópia de `keys/private-key.pem` num gerenciador de senhas ou pendrive.
Se o arquivo se perder **e** sair da Vercel, é preciso gerar um par novo (seção 4.2).

### 4.1 Como conferir se as chaves estão certas
Na pasta `dominion.flow`, com um token gerado pelo site e o código que foi usado:
```
npm run token:verify -- <token> <XXXX-XXXX-XXXX-XXXX>
```
- `"valid": true` → a chave da Vercel bate com `keys/public-key.txt`.
- `"Assinatura inválida."` → a chave privada da Vercel **não** é a mesma de `keys/`.

### 4.2 Como trocar as chaves (só se vazar ou se perder)
1. `npm run keys -- --force` → gera par novo em `keys/` e atualiza o `.env.local`.
2. Vercel → Settings → Environment Variables → `FLOW_PRIVATE_KEY_PEM` → cole o
   conteúdo novo de `keys/private-key.pem` (inteiro, de BEGIN até END, sem aspas).
3. Vercel → Deployments → ⋯ → **Redeploy**.
4. Na Tool do Flow: peça (prompt restrito) para trocar **somente** o valor da
   constante `PUBLIC_KEY_BASE64` pelo conteúdo novo de `keys/public-key.txt`.
5. Teste uma ativação.

## 5. O token

Formato: `v1.<payload em base64url>.<assinatura em base64url>`

Payload (JSON):
```json
{ "version": 1, "toolId": "flow-space", "challenge": "XXXX-XXXX-XXXX-XXXX", "iat": 1790432590, "exp": 1790433190 }
```

| Campo | Significado |
|---|---|
| `version` | Sempre `1` |
| `toolId` | Sempre `flow-space`. **Identificador interno — não mudar**, mesmo com o nome visível sendo "Dominion Flow". Tem que bater com `EXPECTED_TOOL_ID` na Tool. |
| `challenge` | O código de sessão que a Tool mostrou |
| `iat` | Quando foi gerado (segundos Unix) |
| `exp` | Quando expira. Padrão: `iat + 600` (10 min), ajustável por `FLOW_TOKEN_TTL_SECONDS` |

**Dica de diagnóstico:** o payload não é criptografado, só assinado. Dá para ler
colando o trecho do meio (entre os dois pontos) num decodificador base64url.
Assim se descobre para qual código e até quando o token valia.

Os 10 minutos são o **prazo para colar** o token. Depois de ativada, a Tool fica
liberada a sessão inteira.

## 6. Site de ativação (repositório)

- Pasta local: `C:\Users\Gustavo\Desktop\projetos pessoais\dominion.flow`
- GitHub: https://github.com/gustavostofel2-arch/dominion.flow (conta **gustavostofel2-arch**).
  Repositório anterior (aposentado): `gustavostofel21-art/dominion.flow`.
- Autor dos commits neste repositório: `Gustavo Stofel <gustavostofel2@gmail.com>`
  (configurado só nesta pasta com `git config user.email`). A Vercel no plano Hobby
  **bloqueia o deploy** se o autor do commit não for o dono do projeto — se aparecer
  "Implantação bloqueada", confira `git config user.email` aqui.
- Hospedagem: Vercel (deploy automático a cada push no `main`)
- Stack: Next.js 16 (App Router, TypeScript, Tailwind — o middleware se chama `proxy.ts`), Supabase.

| Arquivo | O que faz |
|---|---|
| `src/app/api/generate-token/route.ts` | API que valida e gera o token (runtime Node, nunca Edge) |
| `src/lib/token.ts` | Monta e assina o token; aceita a chave colada de qualquer jeito (aspas, espaços, `\n`) |
| `src/lib/subscription.ts` | Regra de "assinatura ativa" |
| `src/app/login/page.tsx` | Login e cadastro |
| `src/app/dashboard/` | Tela de gerar ativação |
| `src/app/auth/callback/route.ts` | Retorno do link de confirmação de email |
| `src/proxy.ts` | Mantém a sessão e protege `/dashboard` |
| `supabase/schema.sql` | Todo o banco (pode rodar de novo sem apagar nada) |
| `scripts/generate-keys.mjs` | `npm run keys` — gera o par de chaves |
| `scripts/sign-test-token.mjs` | `npm run token:sign -- CODIGO` — gera token de teste sem o site |
| `scripts/verify-token.mjs` | `npm run token:verify -- TOKEN CODIGO` — confere como a Tool confere |
| `flow-tool/PROMPT-FLOW.md` | Modelo do prompt original da Tool |

### O que a API confere, em ordem
| # | Verificação | Se falhar |
|---|---|---|
| 1 | Usuário logado | 401 → volta ao login |
| 2 | Assinatura ativa e dentro da validade | 403 → tela "Assinatura inativa" |
| 3 | Código no formato `XXXX-XXXX-XXXX-XXXX` | 400 → "Código de sessão inválido" |
| 4 | Menos de 20 tokens na última hora | 429 → "Muitas ativações em pouco tempo" |
| 5 | Assina com a chave privada | 500 → "Erro interno ao gerar token" (chave errada/ausente na Vercel) |
| 6 | Grava em `activation_logs` e devolve o token | — |

### Variáveis de ambiente (Vercel e `.env.local`)
| Variável | Origem | Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Não |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → anon / publishable key | Não |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → service_role / secret key | **Sim** |
| `FLOW_PRIVATE_KEY_PEM` | `keys/private-key.pem` | **Sim** |
| `FLOW_TOKEN_TTL_SECONDS` | `600` (recomendado entre 120 e 600; nunca abaixo de 60) | Não |

Depois de mudar qualquer variável na Vercel: **Redeploy**.

### Supabase — configuração de login
Authentication → URL Configuration:
- Site URL: a URL da Vercel
- Redirect URLs: `https://<sua-url>.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`

### Quem faz o quê
- **Vercel** gera e assina o token (rota `/api/generate-token`, Node.js). A chave privada só existe lá.
- **Supabase** só guarda login, assinaturas e logs. Não usa Edge Functions e não conhece a chave privada.

### Keep-alive do Supabase (plano gratuito)
`.github/workflows/supabase-keepalive.yml` consulta o banco a cada 3 dias para o
Supabase gratuito não pausar o projeto. Precisa dos secrets `SUPABASE_URL` e
`SUPABASE_ANON_KEY` no GitHub (Settings → Secrets and variables → Actions).
Se falhar, o GitHub manda email. Pode ser apagado quando o Supabase for Pro.
Atenção: o GitHub desativa agendamentos em repositórios sem nenhum commit por 60 dias
(ele avisa por email; é só reativar na aba Actions).

## 7. Banco de dados (Supabase)

### `public.subscriptions` — uma linha por usuário
| Coluna | Significado |
|---|---|
| `user_id` | ID do usuário (liga ao login) |
| `email` | Cópia automática do email do login (só leitura, mantida por trigger) |
| `status` | `active` ou `inactive` |
| `plan` | Anotação livre (ex.: `mensal`) — o sistema não usa |
| `current_period_end` | Vencimento. Vazio = sem prazo. Se passou, conta como inativa mesmo com `active` |
| `created_at` / `updated_at` | Automáticos |

- Toda conta nova nasce `inactive` (trigger `on_auth_user_created`).
- O usuário só **lê** a própria linha (RLS). Só o painel / service_role escreve.

**Regra de ativa:** `status = 'active'` **e** (`current_period_end` vazio **ou** no futuro).

### `public.activation_logs` — um registro por token gerado
`user_id`, `challenge`, `ip`, `created_at`. Só o service_role acessa.
Serve para o limite de uso e para detectar compartilhamento de conta.

### Comandos do dia a dia (SQL Editor)
```sql
-- Ativar por 30 dias
update public.subscriptions
   set status = 'active', plan = 'mensal', current_period_end = now() + interval '30 days'
 where email = 'cliente@email.com';

-- Desativar
update public.subscriptions set status = 'inactive' where email = 'cliente@email.com';

-- Ver todos
select email, status, plan, current_period_end from public.subscriptions order by updated_at desc;

-- Suspeita de compartilhamento (últimos 7 dias)
select u.email, count(*) as tokens, count(distinct l.ip) as ips
  from public.activation_logs l join auth.users u on u.id = l.user_id
 where l.created_at > now() - interval '7 days'
 group by u.email order by tokens desc;
```
Se o `update` responder **0 rows**: o email está errado ou a coluna/linha não existe
— rode o `supabase/schema.sql` inteiro de novo (não apaga nada).

## 7.1 Lastlink (vendas e assinaturas) — adicionado em 01/10/2026

A Lastlink avisa cada venda/renovação/cancelamento por **webhook** e o sistema
atualiza `subscriptions` sozinho. O cliente só consegue **criar acesso** no site
se o e-mail dele tiver assinatura ativa.

**Onde roda:** na Vercel, rota `POST /api/webhooks/lastlink?key=<LASTLINK_WEBHOOK_SECRET>`.
Toda a regra fica na função SQL `public.process_lastlink_event` (uma transação só:
grava o aviso, ignora duplicado, atualiza a assinatura). Não usa Supabase Edge Functions.

**Validação do aviso:** a documentação da Lastlink não diz onde ela manda o token da
integração. Por isso a URL leva um segredo nosso (`?key=`), comparado em tempo
constante; sem ele → 401. O sistema também registra, em `webhook_events.meta`,
quais cabeçalhos chegaram e se o token da Lastlink (`LASTLINK_TOKEN`) apareceu —
quando confirmado, dá para exigir com `LASTLINK_REQUIRE_TOKEN=true`.

**O que cada evento faz:**
| Evento Lastlink | Efeito |
|---|---|
| `Purchase_Order_Confirmed` (Compra Completa), `Recurrent_Payment` (Renovação) | **active**; renova em = pagamento + 1 mês (igual ao "Renova em" da Lastlink, ou o `NextBilling` dela se vier); acesso até a renovação + 3 dias de tolerância; grava valor, método, recorrência |
| `Product_Access_Started`, `Subscription_Product_Access` (Add) | **active** |
| `Subscription_Canceled` | **Continua ativo até a data de renovação (sem tolerância)** (`cancel_at_period_end = true`); grava motivo |
| `Subscription_Expired`, `Payment_Refund`, `Payment_Chargeback`, `Product_Access_Ended`, `Subscription_Product_Access` (Remove) | **inactive** na hora |
| `Subscription_Renewal_Pending` | Marca `renewal_pending`; não derruba (a tolerância cobre) |
| `Purchase_Request_*`, `Refund_Requested`, `Refund_Period_Over`, `Active_Member_Notification` | Só atualiza dados de contato |
| `Abandoned_Cart` e desconhecidos | Só registra o aviso |

**Proteções:** nomes de evento comparados sem diferenciar maiúsculas (a Lastlink usa grafias diferentes, ex.: `Product_access_started`, `Subscription_Product_Acess`); aviso repetido (mesmo `Id`) é ignorado e o mesmo evento com `Id` diferente (a Lastlink avisa que pode duplicar) dá o mesmo resultado; aviso mais antigo que o último
aplicado é ignorado (`stale_ignored`); reembolso/cancelamento de uma assinatura
**antiga** não derruba a nova (`other_subscription_ignored`); eventos de teste
(`IsTest`) não mexem em clientes reais; produtos fora de `LASTLINK_PRODUCT_IDS`
são ignorados. Se a gravação falhar, responde 500 e nada fica pela metade.

**Tudo que chega fica guardado** em `public.webhook_events` (aviso completo + o que
o sistema fez). Consulta pronta no fim do `schema.sql`.

**Cadastro:** cadastro público do Supabase **desligado**. A rota `POST /api/signup`
só cria a conta (já confirmada, sem e-mail) se o e-mail tiver assinatura ativa.
Quem fica inativo continua conseguindo entrar, mas não gera token.
Senha esquecida: redefinir pelo SQL do fim do `schema.sql` (até configurar o Resend).

**Variáveis novas na Vercel:** `LASTLINK_WEBHOOK_SECRET` (obrigatória; gerada com
`npm run lastlink:secret`, fica em `keys/lastlink-webhook.txt`), `LASTLINK_TOKEN`,
`LASTLINK_REQUIRE_TOKEN`, `LASTLINK_PRODUCT_IDS`, `LASTLINK_PERIOD_MONTHS` (1 = mensal),
`LASTLINK_GRACE_DAYS` (3), `LASTLINK_APPLY_TEST_EVENTS` (false), `NEXT_PUBLIC_CHECKOUT_URL`.

**Diagnóstico:**
| Sintoma | Onde olhar |
|---|---|
| Cliente pagou e não consegue criar acesso | `webhook_events` do e-mail dele: chegou? qual `result`? E-mail da compra é o mesmo digitado? |
| Nenhum aviso chega | URL na Lastlink (com `?key=`), integração ligada, eventos marcados; logs da Vercel (`[lastlink]`) |
| Lastlink mostra erro 401 | `?key=` da URL diferente de `LASTLINK_WEBHOOK_SECRET` na Vercel |
| Lastlink mostra erro 500 | Logs da Vercel; `schema.sql` aplicado? `SUPABASE_SERVICE_ROLE_KEY` certa? |
| `result = test_ignored` | Era evento de teste (botão "Testar") — normal |
| `result = ignored_other_product` | Produto não está em `LASTLINK_PRODUCT_IDS` |

## 8. A Tool no Google Flow

A Tool foi **recriada do zero** depois que a versão anterior começou a dar erros.
A tela de ativação foi adicionada por prompt restrito, com:

- `generateSessionCode()` — código `XXXX-XXXX-XXXX-XXXX` (A-Z, 0-9), gerado **uma vez** por carregamento, só em memória.
- `verifyToken(token, codigo)` — confere, nesta ordem: formato → **assinatura** (chave pública) → `version`/`toolId` → código da sessão → validade.
- `copySessionCode()` — tenta `navigator.clipboard`, depois `execCommand('copy')`; se ambos falharem, deixa o código selecionado e mostra "Aperte Ctrl+C".
- `ActivationGate` — camada por cima da ferramenta até ativar; "ativado" fica só em memória.
- Constantes que **não podem mudar**: `PUBLIC_KEY_BASE64 = 'rjlo/LSRo6F5AAk9Y4TgCXLvGzOyj26xECwyfL9ejQQ='` e `EXPECTED_TOOL_ID = 'flow-space'`.

Ajustes feitos depois, também por prompt restrito:
1. Título da tela de ativação trocado para **"DOMINION FLOW"** (o `toolId` interno continuou `flow-space`).
2. Tela de ativação com rolagem e layout compacto em telas baixas (o topo cortava sem F11).
3. Linhas de conexão entre nós: curva Bézier suave, contínua, fina (1.5px), opacidade 0.45.

O nome "FlowSpace Activation" na barra do Flow é o nome da Tool nas configurações
do Flow — não é alterado por prompt.

### Regra para qualquer prompt no Flow
Todo prompt deve ser **restrito**: dizer exatamente o que mudar, proibir mexer em
layout, outras funções, `verifyToken` e na lógica de ativação, e pedir a lista do
que foi alterado. Conferir essa lista antes de testar.

## 9. Diagnóstico de erros

### Mensagens na Tool
| Mensagem | Causa | Correção |
|---|---|---|
| **Este token não pertence a esta sessão.** | O token foi gerado para outro código. Acontece se a Tool recarregou (inclusive quando a IA do Flow edita a Tool) ou se o token veio de outra pessoa. | Copiar o código **atual**, gerar token novo. Testar na aba **Ferramenta**, não em **Editar**. |
| **Token expirado, gere um novo.** | Passou do prazo (10 min) entre gerar e colar, ou o relógio do PC está muito errado. | Gerar outro; acertar o relógio do Windows (automático). |
| **Assinatura inválida.** | Token alterado/cortado **ou** a chave pública da Tool não é par da privada da Vercel. | Colar o token inteiro. Se persistir: `npm run token:verify` (seção 4.1) e conferir `PUBLIC_KEY_BASE64` na Tool. |
| **Token não é desta ferramenta.** | `EXPECTED_TOOL_ID` da Tool ≠ `flow-space`. | Pedir à IA do Flow para voltar a constante para `'flow-space'`. |
| **Formato de token inválido.** | Colou algo que não é token (ex.: texto antigo da área de transferência). | Copiar de novo o token do site. |
| **Erro ao processar o token.** | Token truncado/corrompido. | Copiar de novo, inteiro. |
| Botão "Copiar" cola outro texto | Clipboard bloqueado pelo Flow; ficou o conteúdo anterior. | Clicar no código e usar Ctrl+C. |

### Mensagens no site
| Mensagem | Causa | Correção |
|---|---|---|
| Assinatura inativa | `status` ≠ `active` ou vencida | Ativar no SQL Editor (seção 7) |
| Limite de ativações por hora atingido | Mais de 20 tokens em 1 hora | Esperar |
| Erro interno ao gerar token | `FLOW_PRIVATE_KEY_PEM` ausente/errada na Vercel | Colar de novo a chave (seção 4.2, passos 2–3, sem gerar par novo) e Redeploy. Logs: Vercel → Deployments → Functions/Logs |
| Erro ao verificar assinatura | Supabase fora do ar ou variáveis do Supabase erradas | Conferir as 3 variáveis do Supabase na Vercel |
| Link de confirmação inválido ou expirado | Redirect URL não cadastrada no Supabase | Seção 6, "Supabase — configuração de login" |
| Site inteiro com erro 500 | Variáveis do Supabase ausentes na Vercel | Cadastrar e Redeploy |

## 10. Limitações conhecidas (aceitas)

1. **Assinante gerando token para outra pessoa:** se um cliente ativo receber o código
   de sessão de outra pessoa, ele consegue gerar um token válido para ela. A Tool não
   identifica quem está usando. Mitigação: token de 10 min, limite de 20 tokens/hora e a
   consulta de compartilhamento (seção 7).
2. **Desativar não derruba uma sessão já liberada:** quem já ativou continua até
   fechar a Tool. Depois disso, não consegue gerar token novo.
3. **Tool editável/duplicável:** se o usuário final conseguir editar ou duplicar a Tool
   no Flow, ele pode remover a tela de ativação. Nenhum sistema só no navegador impede isso.

## 11. Histórico

| Data | O que foi feito |
|---|---|
| 26/09/2026 | Site criado (Next.js + Supabase + Ed25519), repositório no GitHub, chaves definitivas geradas localmente, `schema.sql` aplicado, deploy na Vercel. |
| 26/09/2026 | Correção: aceitar chave privada colada com espaços/quebras na Vercel. |
| 26/09/2026 | Teste ponta a ponta aprovado (ativo libera; inativo bloqueia; token de outra sessão/reaproveitado é recusado). |
| 26/09/2026 | Coluna `email` adicionada em `subscriptions` (com triggers). |
| 27/09–01/10/2026 | Tool recriada no Flow; tela de ativação refeita com os mesmos parâmetros; nome "DOMINION FLOW"; ajuste de layout; linhas de conexão curvas. |
| 01/10/2026 | Deploy bloqueado na Vercel (autor do commit era o email da Genesis). Projeto migrado para a conta GitHub `gustavostofel2-arch`, com Vercel e Supabase novos e as **mesmas chaves Ed25519** (Tool do Flow sem alteração). |
| 01/10/2026 | Integração Lastlink: webhook, tabela `webhook_events`, `subscriptions` passa a ser por e-mail (com nome, telefone, documento, pagamento), cadastro restrito a compradores, limite de 20 tokens/hora. |

## 12. Próximos passos possíveis (não feitos)
- Pagamento automático (Kiwify / Hotmart / Mercado Pago / Stripe) via webhook para ativar sozinho.
- Limite diário de tokens por conta e alerta de muitos IPs.
- Trocar "FlowSpace" por "Dominion Flow" nas telas do site (login e dashboard).
