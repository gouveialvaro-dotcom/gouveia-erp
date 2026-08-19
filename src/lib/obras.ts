// Constantes do módulo de Obras (acompanhamento pós-venda).

export const ORDEM_STATUS_OBRA = ["em_andamento", "atrasada", "concluida"] as const;

export const ROTULO_STATUS_OBRA: Record<
  string,
  { texto: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  em_andamento: { texto: "Em andamento", variant: "secondary" },
  atrasada: { texto: "Atrasada", variant: "destructive" },
  concluida: { texto: "Concluída", variant: "default" },
};
