// Ferramentas exibidas na área de membros. Todas usam a mesma ativação.
export type Tool = {
  id: "flow" | "creator";
  name: string;
  tagline: string;
  description: string;
  features: string[];
  url: string;
};

export const TOOLS: Tool[] = [
  {
    id: "flow",
    name: "Flow Turbo",
    tagline: "Workflows em nodes",
    description:
      "Monte seu fluxo conectando nodes de prompt, imagem e vídeo num canvas, no estilo Freepik, e automatize a produção.",
    features: ["Canvas de nodes", "Prompt → imagem → vídeo", "Fluxos reaproveitáveis"],
    url: "https://flow.google.com/shared/tool/4ae49618-896c-423a-aca0-f4b1387a497a",
  },
  {
    id: "creator",
    name: "Dominion Creator",
    tagline: "Fábrica de vídeos",
    description:
      "Da foto do produto aos vídeos prontos: gere imagens em lote, aprove as melhores, crie os takes com fala e baixe tudo de uma vez.",
    features: ["Até 4 imagens por prompt", "Aprovação de imagens e vídeos", "Download em lote"],
    url: "https://flow.google.com/shared/tool/1622f355-7761-4233-8556-7e11e1ced02d",
  },
];
