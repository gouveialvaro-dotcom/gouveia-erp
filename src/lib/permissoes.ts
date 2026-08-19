export type Perfil = "comercial" | "engenharia" | "obra" | "admin" | "atendimento";

export type Modulo =
  | "clientes"
  | "cadastrosGerais" // materiais, kits, funcionarios, parametros
  | "orcamentos"
  | "crm"
  | "posVenda" // chamados, tipos de problema, concessionárias e UCs
  | "obras"
  | "dashboards"
  | "administracao";

export type NivelAcesso = "nenhum" | "leitura" | "escrita";

export const ROTULO_PERFIL: Record<Perfil, string> = {
  comercial: "Comercial",
  engenharia: "Engenharia",
  obra: "Obra",
  atendimento: "Atendimento ao cliente",
  admin: "Administrador",
};

// Matriz de permissões — ponto de partida definido no escopo da Fase 1.
// Fonte única de verdade: usada tanto na UI (esconder/mostrar) quanto nas
// rotas de API (bloquear de fato). Nunca confiar apenas na UI.
const MATRIZ: Record<Modulo, Record<Perfil, NivelAcesso>> = {
  clientes: {
    comercial: "escrita",
    engenharia: "leitura",
    obra: "nenhum",
    // Atendimento lê o cadastro do cliente para trabalhar o chamado, mas quem
    // altera dado mestre de cliente é o comercial. As unidades consumidoras
    // moram nessa tela e são exceção: a escrita delas depende de "posVenda".
    atendimento: "leitura",
    admin: "escrita",
  },
  cadastrosGerais: {
    comercial: "leitura",
    engenharia: "escrita",
    obra: "leitura",
    atendimento: "nenhum",
    admin: "escrita",
  },
  orcamentos: {
    comercial: "escrita",
    engenharia: "escrita",
    obra: "nenhum",
    atendimento: "nenhum",
    admin: "escrita",
  },
  crm: {
    comercial: "escrita",
    engenharia: "leitura",
    obra: "nenhum",
    atendimento: "nenhum",
    admin: "escrita",
  },
  // Quem toca o pós-venda é o atendimento ao cliente e o admin. Comercial e
  // engenharia enxergam para acompanhar reincidência e falha de equipamento,
  // mas não movimentam chamado.
  posVenda: {
    comercial: "leitura",
    engenharia: "leitura",
    obra: "nenhum",
    atendimento: "escrita",
    admin: "escrita",
  },
  obras: {
    comercial: "leitura",
    engenharia: "escrita",
    obra: "escrita",
    atendimento: "leitura",
    admin: "escrita",
  },
  dashboards: {
    comercial: "leitura",
    engenharia: "leitura",
    obra: "leitura",
    atendimento: "leitura",
    admin: "leitura",
  },
  administracao: {
    comercial: "nenhum",
    engenharia: "nenhum",
    obra: "nenhum",
    atendimento: "nenhum",
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
