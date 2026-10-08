// Modelos de e-mail/WhatsApp do painel admin. Arquivo puro (sem servidor): usado na
// prévia da tela e no envio. Os textos salvos no banco substituem estes padrões.

export const SITE_URL = "https://dominion-flow.app";
// Links fixos dos e-mails. O checkout é o do produto oficial na Lastlink (só para os e-mails;
// o botão "Assinar agora" da área de membros continua usando NEXT_PUBLIC_CHECKOUT_URL).
export const EMAIL_CHECKOUT_URL = "https://lastlink.com/p/CFBB49CB7/checkout-payment/";
// Para onde vão as respostas dos clientes, se nada for salvo na aba E-mails.
export const DEFAULT_REPLY_TO = "gustavostofel2@gmail.com";
export const SUPPORT_WHATSAPP = "5521984073616";
export const SUPPORT_WHATSAPP_LABEL = "(21) 98407-3616";

export type EmailTemplate = {
  id: string;
  name: string;
  hint: string;
  subject: string;
  body: string;
  button_label: string | null;
  button_url: string | null;
};

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "primeiro-acesso",
    name: "Primeiro acesso",
    hint: "Pagou e ainda não criou a conta",
    subject: "{{nome}}, seu acesso ao Dominion está liberado",
    body:
      "Olá, {{nome}}!\n\n" +
      "Sua compra foi confirmada e o seu acesso ao Dominion já está liberado.\n\n" +
      "Para começar, crie sua senha em 1 minuto:\n" +
      "1. Entre em {{link_login}}\n" +
      "2. Clique na aba \"Primeiro acesso\"\n" +
      "3. Use este e-mail: {{email}}\n" +
      "4. Crie sua senha e pronto\n\n" +
      "Qualquer dúvida, é só chamar a gente no WhatsApp: {{whatsapp_suporte}}",
    button_label: "Criar minha senha",
    button_url: "{{link_login}}",
  },
  {
    id: "nunca-ativou",
    name: "Nunca gerou token",
    hint: "Criou a conta, mas nunca ativou a ferramenta",
    subject: "{{nome}}, falta só um passo para usar o Dominion",
    body:
      "Olá, {{nome}}!\n\n" +
      "Vimos que você já criou sua conta, mas ainda não ativou a ferramenta. É rapidinho:\n\n" +
      "1. Abra o Dominion Flow (ou o Dominion Creator) no Google Flow e copie o código de sessão\n" +
      "2. Entre na sua área de membros: {{link_painel}}\n" +
      "3. Cole o código no campo de ativação e copie o token gerado\n" +
      "4. Volte para a ferramenta, cole o token e clique em Ativar\n\n" +
      "Se travar em qualquer etapa, chama a gente no WhatsApp que a gente te ajuda na hora: {{whatsapp_suporte}}",
    button_label: "Ir para a área de membros",
    button_url: "{{link_painel}}",
  },
  {
    id: "carrinho",
    name: "Carrinho abandonado",
    hint: "Entrou no checkout e não comprou",
    subject: "{{nome}}, ficou alguma dúvida sobre o Dominion?",
    body:
      "Olá, {{nome}}!\n\n" +
      "Vi que você começou a assinatura do Dominion e não finalizou. Ficou alguma dúvida?\n\n" +
      "Se quiser, me chama no WhatsApp que eu te explico tudo: {{whatsapp_suporte}}",
    button_label: "Finalizar minha assinatura",
    button_url: "{{link_checkout}}",
  },
  {
    id: "renovacao",
    name: "Renovação chegando",
    hint: "Assinatura renova nos próximos dias",
    subject: "{{nome}}, sua assinatura do Dominion renova em breve",
    body:
      "Olá, {{nome}}!\n\n" +
      "Passando para avisar que sua assinatura ({{plano}}) renova em {{renovacao}}.\n\n" +
      "Está tudo certo com a ferramenta? Se precisar de ajuda, chama no WhatsApp: {{whatsapp_suporte}}",
    button_label: "Abrir minha área de membros",
    button_url: "{{link_painel}}",
  },
  {
    id: "livre",
    name: "Mensagem livre",
    hint: "Escreva o que quiser",
    subject: "Mensagem do Dominion",
    body: "Olá, {{nome}}!\n\n",
    button_label: null,
    button_url: null,
  },
];

export const VARIABLES = [
  { key: "nome", label: "Primeiro nome" },
  { key: "nome_completo", label: "Nome completo" },
  { key: "email", label: "E-mail" },
  { key: "plano", label: "Plano" },
  { key: "renovacao", label: "Data de renovação" },
  { key: "link_site", label: "Site (dominion-flow.app)" },
  { key: "link_login", label: "Link de login" },
  { key: "link_painel", label: "Link da área de membros" },
  { key: "link_checkout", label: "Link do checkout" },
  { key: "whatsapp_suporte", label: "WhatsApp de suporte" },
];

export type Recipient = {
  email: string;
  name: string | null;
  plan?: string | null;
  renewal?: string | null;
};

export function templateVars(r: Recipient, checkoutUrl: string | null): Record<string, string> {
  const full = (r.name ?? "").trim();
  const first = full.split(/\s+/)[0] ?? "";
  const nice = first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
  return {
    nome: nice || "tudo bem",
    nome_completo: full || r.email,
    email: r.email,
    plano: r.plan ?? "",
    renovacao: r.renewal ?? "",
    link_site: `${SITE_URL}/`,
    link_login: `${SITE_URL}/login`,
    link_painel: `${SITE_URL}/dashboard`,
    link_checkout: checkoutUrl ?? EMAIL_CHECKOUT_URL,
    whatsapp_suporte: SUPPORT_WHATSAPP_LABEL,
  };
}

/** Troca {{variavel}} pelos valores (variáveis desconhecidas ficam vazias). */
export function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/** Texto pronto para o WhatsApp (corpo do modelo + link do botão, se houver). */
export function whatsappText(t: Pick<EmailTemplate, "body" | "button_url">, vars: Record<string, string>) {
  const body = fill(t.body, vars).trim();
  const url = t.button_url ? fill(t.button_url, vars) : "";
  return url && !body.includes(url) ? `${body}\n\n${url}` : body;
}

export function mergeTemplates(saved: Partial<EmailTemplate & { id: string }>[]): EmailTemplate[] {
  return DEFAULT_TEMPLATES.map((d) => {
    const s = saved.find((x) => x.id === d.id);
    return s
      ? { ...d, subject: s.subject ?? d.subject, body: s.body ?? d.body, button_label: s.button_label ?? null, button_url: s.button_url ?? null }
      : d;
  });
}
