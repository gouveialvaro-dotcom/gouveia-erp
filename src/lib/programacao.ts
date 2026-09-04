// Constantes e regras puras da Programação de Logística. Vive fora de
// actions.ts porque um arquivo "use server" só pode exportar funções async —
// mesma razão de lib/pos-venda.ts. Nada aqui toca o banco: pode ser importado
// por Client Component sem arrastar o client de service role junto.
//
// É de propósito que a montagem da ocupação do dia e o texto das mensagens
// morem aqui: a MESMA função roda na tela (desabilitando a opção e mostrando o
// motivo) e no servidor (barrando de fato e escrevendo o aviso). Esconder a
// opção na lista nunca substitui o bloqueio na Server Action.

import type { Database } from "@/lib/database.types";
import { diferencaEmDias, hojeIso, somarDias } from "@/lib/pos-venda";
import { formatarData } from "@/lib/format";

type Enums = Database["public"]["Enums"];

export type StatusProgramacao = Enums["StatusProgramacao"];
export type TipoDestinoProgramacao = Enums["TipoDestinoProgramacao"];
export type TipoVeiculo = Enums["TipoVeiculo"];
export type TipoIndisponibilidade = Enums["TipoIndisponibilidade"];
export type PapelDestinatario = Enums["PapelDestinatario"];

// --- Rótulos --------------------------------------------------------------

export const ROTULO_TIPO_VEICULO: Record<TipoVeiculo, string> = {
  caminhonete: "Caminhonete",
  van: "Van",
  munck: "Munck",
  caminhao: "Caminhão",
  carro_passeio: "Carro de passeio",
  outro: "Outro",
};

export const ROTULO_STATUS_PROGRAMACAO: Record<
  StatusProgramacao,
  { texto: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  rascunho: { texto: "Rascunho", variant: "outline" },
  publicada: { texto: "Publicada", variant: "secondary" },
  cancelada: { texto: "Cancelada", variant: "destructive" },
};

export const ROTULO_TIPO_DESTINO: Record<TipoDestinoProgramacao, string> = {
  obra: "Obra",
  avulso: "Destino avulso",
};

export const ROTULO_TIPO_INDISPONIBILIDADE: Record<TipoIndisponibilidade, string> = {
  funcionario: "Funcionário",
  veiculo: "Veículo",
};

export const ROTULO_PAPEL: Record<PapelDestinatario, string> = {
  responsavel: "Responsável",
  motorista_novo: "Motorista",
  motorista_removido: "Motorista retirado",
};

/** Campos que a mensagem sabe narrar. É a lista fechada de AlteracaoProgramacao.campo. */
export const CAMPOS_ALTERACAO = [
  "data",
  "destino",
  "servico",
  "veiculo",
  "motorista",
  "equipe",
  "responsaveis",
  "observacao",
  "cancelamento",
] as const;

export type CampoAlteracao = (typeof CAMPOS_ALTERACAO)[number];

export const ROTULO_CAMPO_ALTERACAO: Record<CampoAlteracao, string> = {
  data: "Data",
  destino: "Destino",
  servico: "Serviço",
  veiculo: "Veículo",
  motorista: "Motorista",
  equipe: "Equipe",
  responsaveis: "Responsáveis",
  observacao: "Observação",
  cancelamento: "Situação",
};

// --- Escopo e agrupamento da grade ---------------------------------------

export const ESCOPOS = ["dia", "semana", "mes"] as const;
export type Escopo = (typeof ESCOPOS)[number];

export const ROTULO_ESCOPO: Record<Escopo, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
};

export const AGRUPAMENTOS = ["destino", "veiculo", "pessoa"] as const;
export type Agrupamento = (typeof AGRUPAMENTOS)[number];

// A mesma grade reordenada responde a três perguntas diferentes: por destino,
// "o que vai acontecer em cada obra"; por veículo, "que carro está ocioso";
// por pessoa, "quem está sem alocação". Sem as três, a ociosidade só apareceria
// por conferência manual.
export const ROTULO_AGRUPAMENTO: Record<Agrupamento, string> = {
  destino: "Por destino",
  veiculo: "Por veículo",
  pessoa: "Por pessoa",
};

export function escopoValido(valor: string | undefined | null): Escopo {
  return ESCOPOS.includes(valor as Escopo) ? (valor as Escopo) : "semana";
}

export function agrupamentoValido(valor: string | undefined | null): Agrupamento {
  return AGRUPAMENTOS.includes(valor as Agrupamento) ? (valor as Agrupamento) : "destino";
}

// --- Datas ----------------------------------------------------------------
// Tudo é string "YYYY-MM-DD" em UTC, com os helpers já existentes do pós-venda.
// Converter para Date local desloca o dia em fuso negativo, e programação
// exibida um dia errado é falha grave neste módulo: a equipe sai no dia errado.
// Nenhuma biblioteca de data nova entra por causa disso.

const NOME_DIA_SEMANA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

const NOME_DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const NOME_MES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** 0 = domingo … 6 = sábado, lido em UTC (nunca no fuso do servidor). */
export function diaDaSemana(dataIso: string) {
  const [ano, mes, dia] = dataIso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function nomeDiaSemana(dataIso: string) {
  return NOME_DIA_SEMANA[diaDaSemana(dataIso)];
}

export function nomeDiaCurto(dataIso: string) {
  return NOME_DIA_CURTO[diaDaSemana(dataIso)];
}

export function ehFimDeSemana(dataIso: string) {
  const dia = diaDaSemana(dataIso);
  return dia === 0 || dia === 6;
}

/** "05/09 (sexta)" — formato de data de toda mensagem que sai. */
export function dataComDiaSemana(dataIso: string) {
  return `${formatarData(dataIso).slice(0, 5)} (${nomeDiaSemana(dataIso)})`;
}

/** Segunda-feira da semana da data. A semana da logística começa na segunda. */
export function inicioDaSemana(dataIso: string) {
  const dia = diaDaSemana(dataIso);
  // Domingo (0) pertence à semana que começou na segunda anterior, seis dias
  // atrás — não à que começa amanhã.
  const recuo = dia === 0 ? 6 : dia - 1;
  return somarDias(dataIso, -recuo);
}

export function inicioDoMes(dataIso: string) {
  return `${dataIso.slice(0, 7)}-01`;
}

export function fimDoMes(dataIso: string) {
  const [ano, mes] = dataIso.slice(0, 10).split("-").map(Number);
  // Dia 0 do mês seguinte é o último dia deste mês, sem tabela de dias.
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

/** Intervalo fechado [inicio, fim] que a grade exibe. */
export function intervaloDoEscopo(escopo: Escopo, referencia: string) {
  if (escopo === "dia") return { inicio: referencia, fim: referencia };
  if (escopo === "mes") return { inicio: inicioDoMes(referencia), fim: fimDoMes(referencia) };
  const inicio = inicioDaSemana(referencia);
  return { inicio, fim: somarDias(inicio, 6) };
}

/** Referência do período anterior/seguinte, para os botões de navegação. */
export function deslocarReferencia(escopo: Escopo, referencia: string, passos: number) {
  if (escopo === "dia") return somarDias(referencia, passos);
  if (escopo === "semana") return somarDias(referencia, passos * 7);
  const [ano, mes] = referencia.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1 + passos, 1)).toISOString().slice(0, 10);
}

export function diasDoIntervalo(inicio: string, fim: string) {
  const total = diferencaEmDias(inicio, fim);
  return Array.from({ length: Math.max(0, total) + 1 }, (_, i) => somarDias(inicio, i));
}

export function tituloDoPeriodo(escopo: Escopo, referencia: string) {
  const { inicio, fim } = intervaloDoEscopo(escopo, referencia);
  if (escopo === "dia") return dataComDiaSemana(inicio);
  if (escopo === "mes") {
    const mes = Number(referencia.slice(5, 7)) - 1;
    return `${NOME_MES[mes]} de ${referencia.slice(0, 4)}`;
  }
  return `${formatarData(inicio)} a ${formatarData(fim)}`;
}

/** Linha de data passada é somente leitura — só o admin corrige o que já foi. */
export function linhaEditavel(dataIso: string, ehAdmin: boolean, hoje = hojeIso()) {
  return ehAdmin || dataIso.slice(0, 10) >= hoje;
}

/**
 * Mudança para hoje ou amanhã sai com prefixo de urgência.
 *
 * Mexer na programação com a equipe já saindo tem custo operacional diferente
 * de mexer na da semana que vem: quem lê precisa saber, na primeira linha, se
 * aquilo muda o dia dele agora.
 */
export function ehUrgente(dataIso: string, hoje = hojeIso()) {
  const distancia = diferencaEmDias(hoje, dataIso.slice(0, 10));
  return distancia >= 0 && distancia <= 1;
}

// --- Veículo --------------------------------------------------------------

/**
 * Placa canônica: maiúsculas, só letras e dígitos.
 *
 * Sem isso "PGA-1A23", "pga1a23" e "PGA 1A23" seriam três veículos, e a trava
 * de duplicidade deixaria o mesmo carro sair para dois destinos no mesmo dia —
 * exatamente o que o módulo existe para impedir.
 */
export function normalizarPlaca(placa: string) {
  return placa
    .toUpperCase()
    .normalize("NFD")
    .replace(/[^A-Z0-9]/g, "");
}

/** "(31) 99999-8888" -> aceito; formato brasileiro com DDD. */
export function placaValida(placa: string) {
  const p = normalizarPlaca(placa);
  // Cobre o padrão antigo (AAA1234) e o Mercosul (AAA1A23).
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p);
}

export type VeiculoLegivel = {
  modelo: string;
  placa: string;
  identificacao?: string | null;
};

/**
 * "Hilux SR — PGA1A23" — como o veículo aparece na tela E na mensagem.
 *
 * É este texto que vai congelado para AlteracaoProgramacao: se o veículo for
 * renomeado depois, o histórico continua contando o que a pessoa viu no dia.
 */
export function descricaoVeiculo(veiculo: VeiculoLegivel | null | undefined) {
  if (!veiculo) return null;
  const apelido = veiculo.identificacao ? ` (${veiculo.identificacao})` : "";
  return `${veiculo.modelo}${apelido} — ${veiculo.placa}`;
}

// --- Ocupação do dia ------------------------------------------------------
// A trava de duplicidade e a de indisponibilidade nascem daqui. A tela usa o
// resultado para desabilitar a opção com o motivo ao lado; a Server Action usa
// o MESMO resultado para recusar a gravação. Uma segunda implementação de um
// dos lados divergiria no primeiro ajuste.

/** O que impede alocar alguém/algo — já em texto para o usuário final. */
export type Impedimento = { motivo: string };

export type Ocupacao = {
  funcionarios: Record<string, Impedimento>;
  veiculos: Record<string, Impedimento>;
};

export type LinhaOcupante = {
  id: string;
  status: StatusProgramacao;
  veiculoId: string | null;
  destino: string;
  equipeIds: string[];
};

export type IndisponibilidadeVigente = {
  funcionarioId: string | null;
  veiculoId: string | null;
  motivo: string;
  dataFim: string;
};

/**
 * Monta a ocupação de UM dia a partir das linhas daquele dia e das
 * indisponibilidades que o cobrem.
 *
 * `ignorarProgramacaoId` existe para a edição: a própria linha sendo editada
 * não pode aparecer como conflito consigo mesma, senão nada mais seria salvo
 * depois da primeira gravação.
 *
 * Linha cancelada não ocupa nada — cancelar é justamente liberar o recurso.
 */
export function montarOcupacao(
  linhas: LinhaOcupante[],
  indisponibilidades: IndisponibilidadeVigente[],
  ignorarProgramacaoId?: string | null
): Ocupacao {
  const ocupacao: Ocupacao = { funcionarios: {}, veiculos: {} };

  for (const linha of linhas) {
    if (linha.status === "cancelada") continue;
    if (ignorarProgramacaoId && linha.id === ignorarProgramacaoId) continue;

    const motivo = `já está alocado em ${linha.destino}`;
    for (const funcionarioId of linha.equipeIds) {
      ocupacao.funcionarios[funcionarioId] ??= { motivo };
    }
    if (linha.veiculoId) {
      ocupacao.veiculos[linha.veiculoId] ??= { motivo: `já está alocado em ${linha.destino}` };
    }
  }

  // A indisponibilidade vence a alocação na mensagem: dizer "em manutenção até
  // 12/09" é mais útil do que "já está alocado", porque muda o que a logística
  // faz em seguida.
  for (const item of indisponibilidades) {
    const motivo = `${item.motivo} — até ${formatarData(item.dataFim)}`;
    if (item.funcionarioId) ocupacao.funcionarios[item.funcionarioId] = { motivo };
    if (item.veiculoId) ocupacao.veiculos[item.veiculoId] = { motivo };
  }

  return ocupacao;
}

export function indisponibilidadeCobre(
  item: { dataInicio: string; dataFim: string },
  dataIso: string
) {
  const data = dataIso.slice(0, 10);
  // Comparação lexicográfica: strings "YYYY-MM-DD" ordenam como datas.
  return item.dataInicio.slice(0, 10) <= data && item.dataFim.slice(0, 10) >= data;
}

// --- Mensagens ------------------------------------------------------------
// Regras de redação, todas com razão de ser:
//  - só o que mudou (exceto no primeiro envio e para o motorista novo, que
//    precisa do quadro completo da linha dele);
//  - equipe como saiu/entrou, nunca a lista inteira — a lista inteira obriga o
//    leitor a comparar mentalmente e é onde o erro passa;
//  - nome legível do destino, nunca id;
//  - e toda mensagem termina avisando que a resposta não é lida. Esse aviso é
//    a contrapartida obrigatória da decisão de descartar as respostas: sem ele
//    a pessoa responde "não vai dar" e acredita ter comunicado.

export const AVISO_SEM_RESPOSTA_RESPONSAVEL =
  "Mensagem automática — respostas não são lidas. Fale direto com a logística.";

export const AVISO_SEM_RESPOSTA_MOTORISTA =
  "Mensagem automática — respostas não são lidas. Fale com o responsável.";

export const AVISO_SEM_RESPOSTA_SIMPLES = "Mensagem automática — respostas não são lidas.";

export type AlteracaoLegivel = {
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
};

export type LinhaLegivel = {
  data: string;
  destino: string;
  servico: string;
  veiculo: string | null;
  motorista: string | null;
  equipe: string[];
  responsaveis: string[];
};

function listaDeTexto(valor: string | null) {
  if (!valor) return [];
  return valor
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Uma linha "• Campo: antes → depois" da mensagem. */
export function linhaDeAlteracao(alteracao: AlteracaoLegivel): string {
  const rotulo = ROTULO_CAMPO_ALTERACAO[alteracao.campo as CampoAlteracao] ?? alteracao.campo;

  if (alteracao.campo === "cancelamento") {
    return "• Programação CANCELADA";
  }

  // Equipe é a única que não vira "antes → depois": a lista completa dos dois
  // lados faria o leitor comparar nome a nome para achar o que mudou.
  if (alteracao.campo === "equipe") {
    const antes = listaDeTexto(alteracao.valorAnterior);
    const depois = listaDeTexto(alteracao.valorNovo);
    const saiu = antes.filter((n) => !depois.includes(n));
    const entrou = depois.filter((n) => !antes.includes(n));
    const partes: string[] = [];
    if (saiu.length) partes.push(`saiu ${saiu.join(", ")}`);
    if (entrou.length) partes.push(`entrou ${entrou.join(", ")}`);
    if (!partes.length) return `• ${rotulo}: sem mudança`;
    return `• ${rotulo}: ${partes.join("; ")}`;
  }

  const antes = alteracao.valorAnterior?.trim() || "—";
  const depois = alteracao.valorNovo?.trim() || "—";
  return `• ${rotulo}: ${antes} → ${depois}`;
}

/** Quadro completo da linha, usado na PRIMEIRA publicação (não há "antes"). */
export function itensDaLinhaCompleta(linha: LinhaLegivel): string[] {
  const itens = [`• Serviço: ${linha.servico}`];
  if (linha.veiculo) itens.push(`• Veículo: ${linha.veiculo}`);
  if (linha.motorista) itens.push(`• Motorista: ${linha.motorista}`);
  if (linha.equipe.length) itens.push(`• Equipe: ${linha.equipe.join(", ")}`);
  return itens;
}

export type BlocoMensagem = {
  data: string;
  destino: string;
  itens: string[];
};

export type AssinaturaMensagem = {
  autor: string;
  perfilAutor: string;
  /** "07h12", já no fuso de Brasília. */
  hora: string;
};

/** Seção "o que mudou nas linhas em que você responde". */
function secaoResponsavel(blocos: BlocoMensagem[]): string {
  const datas = [...new Set(blocos.map((b) => b.data))];
  const umaData = datas.length === 1;

  return blocos
    .map((bloco) => {
      // Com mais de uma data envolvida, cada bloco carrega a sua: sem isso o
      // leitor atribui tudo ao dia do cabeçalho e erra o dia da mudança.
      const titulo = umaData ? bloco.destino : `${dataComDiaSemana(bloco.data)} · ${bloco.destino}`;
      return [titulo, ...bloco.itens].join("\n");
    })
    .join("\n\n");
}

/** Seção do motorista atual: quadro COMPLETO da linha dele, não só o diff. */
function secaoMotorista(linha: LinhaLegivel): string {
  const partes = [`${dataComDiaSemana(linha.data)} — ${linha.destino}`];
  partes.push(
    linha.veiculo
      ? `Você é o motorista. Veículo: ${linha.veiculo}.`
      : "Você é o motorista desta programação."
  );
  partes.push(`Serviço: ${linha.servico}.`);
  if (linha.equipe.length) partes.push(`Equipe: ${linha.equipe.join(", ")}.`);
  if (linha.responsaveis.length) partes.push(`Responsável: ${linha.responsaveis.join(", ")}.`);
  return partes.join("\n");
}

/** Seção de quem saiu: precisa saber que saiu, e a quem perguntar o que fazer. */
function secaoMotoristaRemovido(linha: Pick<LinhaLegivel, "data" | "destino">): string {
  return [
    `${dataComDiaSemana(linha.data)} — ${linha.destino}`,
    "Você foi retirado desta programação. Confirme sua nova alocação com a logística.",
  ].join("\n");
}

export type ConteudoMensagem = {
  /** Blocos das linhas em que a pessoa é responsável. */
  blocosResponsavel: BlocoMensagem[];
  /** Linhas em que a pessoa é o motorista atual. */
  linhasMotorista: LinhaLegivel[];
  /** Linhas de que a pessoa foi retirada como motorista. */
  linhasRemovido: Pick<LinhaLegivel, "data" | "destino">[];
};

/**
 * A mensagem que sai para UMA pessoa nesta publicação.
 *
 * É um assembler só, e não três funções soltas, porque o encarregado costuma
 * estar em Usuario (como responsável) E em Funcionario (como motorista). Se
 * cada papel montasse a sua mensagem, ele receberia duas quase iguais e
 * passaria a ignorar as duas — por isso os papéis viram seções de um texto só,
 * com UM aviso de "resposta não é lida" no fim.
 */
export function montarMensagem(
  conteudo: ConteudoMensagem,
  assinatura: AssinaturaMensagem,
  urgente: boolean
): string {
  const datas = [
    ...conteudo.blocosResponsavel.map((b) => b.data),
    ...conteudo.linhasMotorista.map((l) => l.data),
    ...conteudo.linhasRemovido.map((l) => l.data),
  ];
  const unicas = [...new Set(datas)].sort();
  const referencia = unicas.length === 1 ? dataComDiaSemana(unicas[0]) : "atualizada";

  const cabecalho = urgente
    ? `⚠️ ALTERAÇÃO URGENTE — Programação ${referencia}`
    : `Programação ${referencia}`;

  const secoes: string[] = [];
  if (conteudo.blocosResponsavel.length) {
    secoes.push(secaoResponsavel(conteudo.blocosResponsavel));
  }
  for (const linha of conteudo.linhasMotorista) secoes.push(secaoMotorista(linha));
  for (const linha of conteudo.linhasRemovido) secoes.push(secaoMotoristaRemovido(linha));

  // O aviso final muda com o papel porque muda a quem a pessoa deve falar:
  // o responsável resolve com a logística; quem vai a campo resolve com o
  // responsável da linha.
  const aviso = conteudo.blocosResponsavel.length
    ? AVISO_SEM_RESPOSTA_RESPONSAVEL
    : conteudo.linhasMotorista.length
      ? AVISO_SEM_RESPOSTA_MOTORISTA
      : AVISO_SEM_RESPOSTA_SIMPLES;

  return [
    cabecalho,
    "",
    secoes.join("\n\n"),
    "",
    `Alterado por ${assinatura.autor} (${assinatura.perfilAutor}) às ${assinatura.hora}.`,
    aviso,
  ].join("\n");
}

// --- Prévia da publicação -------------------------------------------------
// Os tipos ficam aqui, e não em programacao-servidor.ts, para que o modal de
// confirmação (Client Component) possa tipá-los sem importar nada que arraste
// o client de service role junto.

export type DestinatarioPrevia = {
  /** Telefone normalizado — é a chave da deduplicação. */
  chave: string;
  telefoneExibicao: string;
  nome: string;
  papel: PapelDestinatario;
  papeis: string[];
  usuarioId: string | null;
  funcionarioId: string | null;
  mensagem: string;
  urgente: boolean;
};

export type PendenciaPrevia = {
  id: string;
  data: string;
  destino: string;
  primeiraPublicacao: boolean;
  cancelada: boolean;
  itens: string[];
};

export type PreviaPublicacao = {
  pendencias: PendenciaPrevia[];
  destinatarios: DestinatarioPrevia[];
  /** Quem ficaria de fora por falta de telefone — o cadastro precisa de conserto. */
  semTelefone: { nome: string; papel: string }[];
  /** Quem ficaria de fora por ter desligado o aviso individual. */
  silenciados: { nome: string }[];
  totalMensagens: number;
  enviadasHoje: number;
  teto: number;
  excedeTeto: boolean;
};

/**
 * Papel gravado em EnvioWhatsapp quando a pessoa acumula mais de um.
 *
 * A coluna guarda um valor só; o mais forte manda, porque é o que explica por
 * que a mensagem foi enviada. O texto da mensagem, esse sim, traz os dois.
 */
export function papelPrincipal(conteudo: ConteudoMensagem): PapelDestinatario {
  if (conteudo.blocosResponsavel.length) return "responsavel";
  if (conteudo.linhasMotorista.length) return "motorista_novo";
  return "motorista_removido";
}

/** "07h12" no fuso de Brasília — o servidor da Vercel roda em UTC. */
export function horaBrasilia(instante: Date = new Date()) {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instante);
  return texto.replace(":", "h");
}
