export type Perfil = "comercial" | "engenharia" | "obra" | "admin" | "atendimento";

export type Modulo =
  | "clientes"
  | "cadastrosGerais" // materiais, kits, funcionarios, parametros
  | "orcamentos"
  | "crm"
  | "posVenda" // chamados, tipos de problema, concessionárias e UCs
  | "obras"
  | "dashboards"
  | "chat"
  | "administracao"
  | "conta"; // a própria conta do usuário logado: hoje, só a troca de senha

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
  // Todo usuário ativo conversa em qualquer conversa, então a linha é
  // uniforme. Ela existe mesmo assim para que desligar o chat de um perfil
  // depois seja mexer aqui, e não espalhar if pelas telas e actions.
  chat: {
    comercial: "escrita",
    engenharia: "escrita",
    obra: "escrita",
    atendimento: "escrita",
    admin: "escrita",
  },
  administracao: {
    comercial: "nenhum",
    engenharia: "nenhum",
    obra: "nenhum",
    atendimento: "nenhum",
    admin: "escrita",
  },
  // Toda pessoa logada manda na própria senha, inclusive quem não enxerga
  // nenhum outro canto de /administracao. A linha existe para que a troca de
  // senha seja negada num lugar só, caso um dia precise ser desligada para
  // algum perfil — e não com um `if (perfil === ...)` solto na action.
  conta: {
    comercial: "escrita",
    engenharia: "escrita",
    obra: "escrita",
    atendimento: "escrita",
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
