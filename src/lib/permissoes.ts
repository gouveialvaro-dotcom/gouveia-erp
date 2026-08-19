export type Perfil = "comercial" | "engenharia" | "obra" | "admin";

export type Modulo =
  | "clientes"
  | "cadastrosGerais" // materiais, kits, funcionarios, parametros
  | "orcamentos"
  | "crm"
  | "obras"
  | "dashboards"
  | "administracao";

export type NivelAcesso = "nenhum" | "leitura" | "escrita";

// Matriz de permissões — ponto de partida definido no escopo da Fase 1.
// Fonte única de verdade: usada tanto na UI (esconder/mostrar) quanto nas
// rotas de API (bloquear de fato). Nunca confiar apenas na UI.
const MATRIZ: Record<Modulo, Record<Perfil, NivelAcesso>> = {
  clientes: {
    comercial: "escrita",
    engenharia: "leitura",
    obra: "nenhum",
    admin: "escrita",
  },
  cadastrosGerais: {
    comercial: "leitura",
    engenharia: "escrita",
    obra: "leitura",
    admin: "escrita",
  },
  orcamentos: {
    comercial: "escrita",
    engenharia: "escrita",
    obra: "nenhum",
    admin: "escrita",
  },
  crm: {
    comercial: "escrita",
    engenharia: "leitura",
    obra: "nenhum",
    admin: "escrita",
  },
  obras: {
    comercial: "leitura",
    engenharia: "escrita",
    obra: "escrita",
    admin: "escrita",
  },
  dashboards: {
    comercial: "leitura",
    engenharia: "leitura",
    obra: "leitura",
    admin: "leitura",
  },
  administracao: {
    comercial: "nenhum",
    engenharia: "nenhum",
    obra: "nenhum",
    admin: "escrita",
  },
};

export function nivelAcesso(perfil: Perfil, modulo: Modulo): NivelAcesso {
  return MATRIZ[modulo][perfil];
}

export function podeLer(perfil: Perfil, modulo: Modulo): boolean {
  return nivelAcesso(perfil, modulo) !== "nenhum";
}

export function podeEscrever(perfil: Perfil, modulo: Modulo): boolean {
  return nivelAcesso(perfil, modulo) === "escrita";
}
