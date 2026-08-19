// Constantes do funil de oportunidades (CRM). Não pode viver em actions.ts
// porque um arquivo "use server" só pode exportar funções async.

export const ORDEM_ESTAGIO_KANBAN = [
  "lead",
  "levantamento_escopo",
  "orcamento_elaboracao",
  "proposta_enviada",
  "negociacao",
  "aprovada",
  "perdida",
] as const;

// Fluxo linear de avanço/retrocesso — "perdida" fica fora porque só é
// atingida explicitamente (com motivo), não por avançar/voltar no Kanban.
export const ORDEM_ESTAGIO_FLUXO = [
  "lead",
  "levantamento_escopo",
  "orcamento_elaboracao",
  "proposta_enviada",
  "negociacao",
  "aprovada",
] as const;

export const ROTULO_ESTAGIO: Record<string, string> = {
  lead: "Lead",
  levantamento_escopo: "Levantamento de escopo",
  orcamento_elaboracao: "Orçamento em elaboração",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  aprovada: "Aprovada",
  perdida: "Perdida",
};

export const ROTULO_TIPO_INTERACAO: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  visita: "Visita",
};
