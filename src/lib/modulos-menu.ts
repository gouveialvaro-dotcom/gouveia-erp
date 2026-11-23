import { podeLer, type Modulo, type Perfil } from "@/lib/permissoes";

// Módulos do menu e tipos de cadastro que o administrador controla por pessoa,
// em Administração → Módulos.
//
// Para o que o perfil já dá, é uma restrição: desmarcar esconde. Guardado em
// Usuario.modulosOcultos como a lista do que está escondido, para que um
// módulo novo apareça para todos até alguém decidir escondê-lo.
//
// Alguns cadastros não dependem do perfil e são liberados pessoa a pessoa
// (Usuario.modulosLiberados) — hoje, só Centros de custo. O admin vê todos.
//
// Administração fica de fora: é por ela que todo mundo troca a própria senha.

export type ChaveMenu =
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

export type TipoCadastro =
  | "clientes"
  | "materiais"
  | "kits"
  | "funcoes"
  | "funcionarios"
  | "veiculos"
  | "tiposProblema"
  | "descricoes"
  | "parametros"
  | "centrosCusto";

/**
 * Abas de Cadastros, na ordem do menu. Com `modulo`, o perfil decide quem lê;
 * sem, o cadastro é liberado por pessoa.
 */
export const TIPOS_CADASTRO: {
  tipo: TipoCadastro;
  titulo: string;
  /** Abas do submenu (Clientes tem duas, uma por ramo). */
  abas: { titulo: string; href: string }[];
  modulo?: Modulo;
}[] = [
  {
    tipo: "clientes",
    titulo: "Clientes",
    modulo: "clientes",
    // Cada ramo tem seu próprio cadastro: energia solar tem unidades e contrato
    // de manutenção; redes/subestações é só o cadastro de contato.
    abas: [
      { titulo: "Clientes · Energia solar", href: "/cadastros/clientes/solar" },
      { titulo: "Clientes · Redes/Subestações", href: "/cadastros/clientes/redes" },
    ],
  },
  { tipo: "materiais", titulo: "Materiais", modulo: "cadastrosGerais", abas: [{ titulo: "Materiais", href: "/cadastros/materiais" }] },
  { tipo: "kits", titulo: "Kits", modulo: "cadastrosGerais", abas: [{ titulo: "Kits", href: "/cadastros/kits" }] },
  { tipo: "funcoes", titulo: "Funções", modulo: "cadastrosGerais", abas: [{ titulo: "Funções", href: "/cadastros/funcoes" }] },
  {
    tipo: "funcionarios",
    titulo: "Funcionários",
    modulo: "cadastrosGerais",
    abas: [{ titulo: "Funcionários", href: "/cadastros/funcionarios" }],
  },
  // A frota tem módulo próprio ("veiculos"): quem a mantém é a logística, que
  // em cadastrosGerais só lê.
  { tipo: "veiculos", titulo: "Veículos", modulo: "veiculos", abas: [{ titulo: "Veículos", href: "/cadastros/veiculos" }] },
  {
    tipo: "tiposProblema",
    titulo: "Tipos de problema",
    modulo: "posVenda",
    abas: [{ titulo: "Tipos de problema", href: "/cadastros/tipos-problema" }],
  },
  {
    tipo: "descricoes",
    titulo: "Descrições padrão",
    modulo: "cadastrosGerais",
    abas: [{ titulo: "Descrições padrão", href: "/cadastros/descricoes" }],
  },
  {
    tipo: "parametros",
    titulo: "Parâmetros gerais",
    modulo: "cadastrosGerais",
    abas: [{ titulo: "Parâmetros gerais", href: "/cadastros/parametros" }],
  },
  {
    tipo: "centrosCusto",
    titulo: "Centros de custo",
    abas: [{ titulo: "Centros de custo", href: "/cadastros/centros-custo" }],
  },
];

/** Chave guardada em modulosOcultos/modulosLiberados para um tipo de cadastro. */
export const chaveCadastro = (tipo: TipoCadastro) => `cadastros.${tipo}`;

const CHAVES_MENU = new Set<string>(MODULOS_MENU.map((m) => m.chave));

export function ehChaveMenu(valor: string): valor is ChaveMenu {
  return CHAVES_MENU.has(valor);
}

/** Módulos que o perfil enxerga — os únicos que faz sentido marcar ou desmarcar. */
export function modulosDoPerfil(perfil: Perfil) {
  return MODULOS_MENU.filter((m) => m.modulos.some((modulo) => podeLer(perfil, modulo)));
}

/** Tipos de cadastro que aparecem na caixa de marcação desta pessoa. */
export function cadastrosConfiguraveis(perfil: Perfil) {
  return TIPOS_CADASTRO.filter((c) => !c.modulo || podeLer(perfil, c.modulo));
}

/** Tipos de cadastro que a pessoa vê, dados o perfil e as marcações. */
export function cadastrosVisiveis(perfil: Perfil, ocultos: string[], liberados: string[]) {
  return TIPOS_CADASTRO.filter((c) => {
    const chave = chaveCadastro(c.tipo);
    if (c.modulo) return podeLer(perfil, c.modulo) && !ocultos.includes(chave);
    return perfil === "admin" || liberados.includes(chave);
  });
}
