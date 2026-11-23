import { podeLer, type Modulo, type Perfil } from "@/lib/permissoes";

// Módulos do menu que o administrador pode esconder de uma pessoa, além do que
// o perfil dela já tira. É uma restrição a mais, nunca uma liberação: quem não
// lê o módulo pelo perfil continua sem ele, marcado ou não. Administração fica
// de fora porque é por ela que todo mundo troca a própria senha.
//
// Guardado em Usuario.modulosOcultos como a lista das chaves escondidas, para
// que um módulo novo apareça para todos até alguém decidir escondê-lo.

export type ChaveMenu =
  | "cadastros"
  | "orcamentos"
  | "crm"
  | "posVenda"
  | "monitoramento"
  | "obras"
  | "programacao"
  | "suprimentos"
  | "chat"
  | "dashboards";

export const MODULOS_MENU: { chave: ChaveMenu; titulo: string; modulos: Modulo[] }[] = [
  { chave: "cadastros", titulo: "Cadastros", modulos: ["clientes", "cadastrosGerais"] },
  { chave: "orcamentos", titulo: "Orçamentos", modulos: ["orcamentos"] },
  { chave: "crm", titulo: "CRM / Propostas", modulos: ["crm"] },
  { chave: "posVenda", titulo: "Pós-venda e WhatsApp", modulos: ["posVenda"] },
  { chave: "monitoramento", titulo: "Monitoramento de usinas", modulos: ["monitoramento"] },
  { chave: "obras", titulo: "Obras", modulos: ["obras"] },
  { chave: "programacao", titulo: "Programação", modulos: ["programacao"] },
  { chave: "suprimentos", titulo: "Suprimentos", modulos: ["suprimentos"] },
  { chave: "chat", titulo: "Chat", modulos: ["chat"] },
  { chave: "dashboards", titulo: "Dashboards", modulos: ["dashboards"] },
];

const CHAVES = new Set<string>(MODULOS_MENU.map((m) => m.chave));

export function ehChaveMenu(valor: string): valor is ChaveMenu {
  return CHAVES.has(valor);
}

/** Módulos que o perfil enxerga — os únicos que faz sentido marcar ou desmarcar. */
export function modulosDoPerfil(perfil: Perfil) {
  return MODULOS_MENU.filter((m) => m.modulos.some((modulo) => podeLer(perfil, modulo)));
}
