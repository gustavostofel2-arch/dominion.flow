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
    name: "Dominion Flow",
    tagline: "Workflows em nodes",
    description:
      "Monte seu fluxo conectando nodes de prompt, imagem e vídeo num canvas, no estilo Freepik, e automatize a produção.",
    features: ["Canvas de nodes", "Prompt → imagem → vídeo", "Fluxos reaproveitáveis"],
    url: "https://flow.google.com/shared/tool/2c2317c0-be12-4c7e-b271-15b0e6f8b674",
  },
  {
    id: "creator",
    name: "Dominion Creator",
    tagline: "Fábrica de vídeos",
    description:
      "Da foto do produto aos vídeos prontos: gere imagens em lote, aprove as melhores, crie os takes com fala e baixe tudo de uma vez.",
    features: ["Até 4 imagens por prompt", "Aprovação de imagens e vídeos", "Download em lote"],
    url: "https://flow.google.com/shared/tool/b36200e8-e81d-4c71-83b9-8f9c9c782e78",
  },
];
