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

export const ROTULO_ORIGEM_OBRA: Record<string, string> = {
  funil: "Do funil",
  manual: "Cadastro manual",
};

// A obra do funil não guarda cliente nem nome de projeto: empresta os dois da
// oportunidade que a originou. A obra manual não tem esse caminho e guarda os
// dois em colunas próprias. Estas duas funções são o único lugar que sabe
// disso — telas e dashboards passam a chamá-las em vez de navegar o embed na
// mão, que era o que fazia a obra manual aparecer como "—".
export type ObraIdentificavel = {
  nomeProjeto?: string | null;
  cliente?: { razaoSocial: string } | null;
  oportunidade?: {
    cliente?: { razaoSocial: string } | null;
    orcamento?: { nomeProjeto: string } | null;
  } | null;
};

export function clienteDaObra(obra: ObraIdentificavel): string {
  return obra.oportunidade?.cliente?.razaoSocial ?? obra.cliente?.razaoSocial ?? "—";
}

export function projetoDaObra(obra: ObraIdentificavel): string {
  return obra.oportunidade?.orcamento?.nomeProjeto ?? obra.nomeProjeto ?? "—";
}
