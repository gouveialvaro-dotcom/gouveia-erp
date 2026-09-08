// Constantes e regras do módulo de Pós-venda. Não pode viver em actions.ts
// porque um arquivo "use server" só pode exportar funções async.

import type { Database } from "@/lib/database.types";
import type { Perfil } from "@/lib/permissoes";

type Enums = Database["public"]["Enums"];
export type EstagioChamado = Enums["EstagioChamado"];
export type PrioridadeChamado = Enums["PrioridadeChamado"];

// Fluxo de trabalho de fato — é o que os botões Voltar/Avançar percorrem.
export const ORDEM_ESTAGIO_FLUXO = [
  "aberto",
  "em_analise",
  "aguardando_concessionaria",
  "concluido",
] as const;

export const ROTULO_ESTAGIO: Record<EstagioChamado, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  aguardando_concessionaria: "Aguardando concessionária",
  concluido: "Concluído",
};

// Colunas do Kanban, na ordem pedida. "a_vencer" e "vencido" não são estágios
// gravados: derivam do prazoLimite. O chamado cai nelas sozinho quando a data
// chega, e o estágio de fluxo em que ele estava continua visível no card — sem
// isso perderíamos a informação de onde o atendimento parou.
export const ORDEM_COLUNA_KANBAN = [
  "aberto",
  "em_analise",
  "a_vencer",
  "aguardando_concessionaria",
  "concluido",
  "vencido",
] as const;

export type ColunaKanban = (typeof ORDEM_COLUNA_KANBAN)[number];

export const ROTULO_COLUNA: Record<ColunaKanban, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  a_vencer: "A vencer",
  aguardando_concessionaria: "Aguardando concessionária",
  concluido: "Concluído",
  vencido: "Vencido",
};

// Colunas derivadas: nelas o card mostra também o estágio de fluxo de origem.
export const COLUNAS_DERIVADAS: ColunaKanban[] = ["a_vencer", "vencido"];

type Variante = "default" | "secondary" | "outline" | "destructive";

export const ROTULO_PRIORIDADE: Record<
  PrioridadeChamado,
  { texto: string; variant: Variante }
> = {
  baixa: { texto: "Baixa", variant: "outline" },
  media: { texto: "Média", variant: "secondary" },
  alta: { texto: "Alta", variant: "default" },
  critica: { texto: "Crítica", variant: "destructive" },
};

export const ROTULO_TIPO_INTERACAO: Record<Enums["TipoInteracaoChamado"], string> = {
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  visita: "Visita técnica",
  agencia_cosern: "Agência Cosern",
  protocolo: "Protocolo",
  nota_interna: "Nota interna",
};

export const ROTULO_DIRECAO: Record<Enums["DirecaoInteracao"], string> = {
  cliente: "Cliente",
  concessionaria: "Concessionária",
  interno: "Interno",
};

export const ROTULO_TIPO_UC: Record<Enums["TipoUnidadeConsumidora"], string> = {
  geradora: "Geradora",
  beneficiaria: "Beneficiária",
};

// Um cliente é sinalizado como recorrente quando acumula MIN_OCORRENCIAS
// chamados do mesmo tipo dentro da janela — sinal de que a causa não foi
// resolvida e o caso pede ação preventiva, não mais um atendimento avulso.
export const MESES_JANELA_RECORRENCIA = 6;
export const MIN_OCORRENCIAS_RECORRENCIA = 3;

// --- Responsável ---------------------------------------------------------
// Todo chamado nasce com dono. O aviso de abertura é dirigido a essa pessoa, e
// não distribuído em lista — sem dono, o chamado é de todos e de ninguém.

// Comercial e engenharia só têm leitura em posVenda e obra não tem acesso
// nenhum: seriam responsáveis incapazes de registrar interação ou de concluir o
// próprio chamado. Por isso a lista de elegíveis é restrita — a matriz de
// permissoes.ts NÃO é afrouxada para acomodar o direcionamento.
export const PERFIS_RESPONSAVEL_CHAMADO: Perfil[] = ["atendimento", "admin"];

export type UsuarioElegivel = { ativo: boolean; perfil: Perfil };

/** Critério único de elegibilidade: monta o combobox da tela e revalida no
 *  servidor. Como em impedimentoDeAbertura(), a tela não é a garantia. */
export function podeSerResponsavel(usuario: UsuarioElegivel) {
  return usuario.ativo && PERFIS_RESPONSAVEL_CHAMADO.includes(usuario.perfil);
}

/** Repassar o chamado é do dono atual ou do admin. Atendimento que não é dono
 *  não mexe em chamado alheio, e chamado concluído não troca de mãos — não há
 *  mais trabalho a repassar. */
export function podeTrocarResponsavel({
  perfil,
  usuarioId,
  responsavelId,
  estagio,
}: {
  perfil: Perfil;
  usuarioId: string;
  responsavelId: string;
  estagio: EstagioChamado;
}) {
  if (estagio === "concluido") return false;
  return perfil === "admin" || usuarioId === responsavelId;
}

// --- Datas ---------------------------------------------------------------
// O SLA corre em dias corridos e nunca pausa, inclusive enquanto se aguarda a
// concessionária. Tudo é feito sobre strings "YYYY-MM-DD" em UTC: converter
// para Date local desloca o dia em fusos negativos (ver formatarData).

function paraUtc(dataIso: string) {
  const [ano, mes, dia] = dataIso.slice(0, 10).split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

const MS_POR_DIA = 86_400_000;

export function hojeIso() {
  // "sv-SE" produz YYYY-MM-DD no fuso local, que é o dia que o usuário vê.
  return new Date().toLocaleDateString("sv-SE");
}

export function somarDias(dataIso: string, dias: number) {
  return new Date(paraUtc(dataIso) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export function diferencaEmDias(de: string, para: string) {
  return Math.round((paraUtc(para) - paraUtc(de)) / MS_POR_DIA);
}

export function mesesAtras(meses: number, referencia = hojeIso()) {
  const [ano, mes, dia] = referencia.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1 - meses, dia)).toISOString().slice(0, 10);
}

// --- SLA -----------------------------------------------------------------

export type ChamadoSla = {
  estagio: EstagioChamado;
  prazoLimite: string;
};

/** Dias que faltam para o prazo. Negativo = dias de atraso. */
export function diasRestantes(chamado: ChamadoSla, hoje = hojeIso()) {
  return diferencaEmDias(hoje, chamado.prazoLimite);
}

export function colunaDoChamado(
  chamado: ChamadoSla,
  diasAlerta: number,
  hoje = hojeIso()
): ColunaKanban {
  if (chamado.estagio === "concluido") return "concluido";
  const restantes = diasRestantes(chamado, hoje);
  if (restantes < 0) return "vencido";
  if (restantes <= diasAlerta) return "a_vencer";
  return chamado.estagio;
}

/** Texto curto do prazo para o card: "vence hoje", "3d restantes", "2d em atraso". */
export function textoPrazo(chamado: ChamadoSla, hoje = hojeIso()) {
  const restantes = diasRestantes(chamado, hoje);
  if (restantes < 0) return `${Math.abs(restantes)}d em atraso`;
  if (restantes === 0) return "vence hoje";
  return `${restantes}d restantes`;
}

// --- Estado do card ------------------------------------------------------
// Duas perguntas diferentes, que o quadro sozinho não respondia: "alguém
// assumiu?" e "o prazo está acabando?". Antes só a segunda tinha cor, então um
// chamado esquecido com prazo longe parecia igual a um sob controle.
//
// PRAZO MANDA MAIS QUE POSSE. A ordem abaixo é a da especificação e o
// early-return implementa exatamente ela: concluído > vencido > a vencer > em
// andamento > aguardando. O chamado que ninguém encostou não perde essa
// informação ao ficar laranja — ela migra para a etiqueta de inatividade.
//
// A janela do laranja é o diasAlerta cadastrado por tipo de problema, o MESMO
// que governa a coluna "A vencer": um segundo número aqui produziria card
// laranja fora da coluna laranja.

export type EstadoCard =
  | "aguardando"
  | "em_andamento"
  | "a_vencer"
  | "vencido"
  | "concluido";

export const ROTULO_ESTADO_CARD: Record<EstadoCard, string> = {
  aguardando: "Aguardando",
  em_andamento: "Em andamento",
  a_vencer: "A vencer",
  vencido: "Vencido",
  concluido: "Concluído",
};

// A palavra não é enfeite: parte da equipe não distingue verde de laranja de
// vermelho, e cor sozinha não pode ser a única fonte da informação. Por isso
// rótulo e cor moram juntos aqui — quem usar um é obrigado a ver o outro.
//
// Cada estado traz o par claro/escuro. Fundo do card NÃO é pintado: quadro
// inteiro colorido vira poluição e some no tema escuro. A cor vive na faixa da
// borda esquerda e na etiqueta.
export const CORES_ESTADO_CARD: Record<EstadoCard, { faixa: string; etiqueta: string }> = {
  aguardando: {
    faixa: "border-l-amber-400 dark:border-l-amber-300",
    etiqueta:
      "border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  em_andamento: {
    faixa: "border-l-emerald-500 dark:border-l-emerald-400",
    etiqueta:
      "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  a_vencer: {
    faixa: "border-l-orange-500 dark:border-l-orange-400",
    etiqueta:
      "border-orange-500/40 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  },
  vencido: {
    faixa: "border-l-red-600 dark:border-l-red-500",
    etiqueta: "border-red-500/40 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
  concluido: {
    faixa: "border-l-emerald-800 dark:border-l-emerald-600",
    etiqueta:
      "border-emerald-800/40 bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  },
};

export type ChamadoEstado = ChamadoSla & {
  /** Nulo enquanto o responsável não agiu — é o que separa amarelo de verde.
   *  Uma vez preenchido não volta atrás, nem por inatividade nem por troca de
   *  dono; o ponto cego disso é coberto pela etiqueta de inatividade. */
  primeiraAcaoResponsavelEm: string | null;
};

export function estadoDoCard(
  chamado: ChamadoEstado,
  diasAlerta: number,
  hoje = hojeIso()
): EstadoCard {
  if (chamado.estagio === "concluido") return "concluido";
  const restantes = diasRestantes(chamado, hoje);
  if (restantes < 0) return "vencido";
  if (restantes <= diasAlerta) return "a_vencer";
  return chamado.primeiraAcaoResponsavelEm ? "em_andamento" : "aguardando";
}

/** Concluído depois do prazo. O verde escuro vence o vermelho na ordem acima,
 *  então sem esta etiqueta o atraso sumiria do card e o indicador de SLA do
 *  dashboard não bateria com o que se vê no quadro. */
export function concluidoForaDoPrazo(chamado: {
  estagio: EstagioChamado;
  concluidoEm: string | null;
  prazoLimite: string;
}) {
  if (chamado.estagio !== "concluido" || !chamado.concluidoEm) return false;
  return chamado.concluidoEm.slice(0, 10) > chamado.prazoLimite.slice(0, 10);
}

// --- Inatividade ---------------------------------------------------------
// Substitui o realce de "parado há 2 dias", que era um estado visual do card e
// disputava atenção com o prazo. Virou ETIQUETA, que convive com qualquer cor:
// um card pode estar verde e parado há seis dias ao mesmo tempo.
//
// É ela que cobre o ponto cego do verde permanente. Uma única ação no primeiro
// dia deixa o card verde para sempre, e um chamado de 90 dias de SLA pode ficar
// dois meses verde e abandonado — o alerta de prazo só acorda no fim. A
// etiqueta acusa isso desde o segundo dia.
//
// Continua sendo estado DERIVADO, e não coluna gravada: coluna precisaria de um
// job para ser mantida e mentiria entre uma passada e outra, enquanto as datas
// já estão no banco e respondem sozinhas a qualquer momento.

export const DIAS_SEM_MOVIMENTO_PADRAO = 2;

export type ChamadoInatividade = {
  estagio: EstagioChamado;
  abertoEm: string;
  primeiraAcaoResponsavelEm: string | null;
  ultimaAcaoResponsavelEm: string | null;
};

/** Data a partir da qual se conta. Sem ação do responsável, o piso é a
 *  abertura: sem esse piso um chamado recém-aberto contaria como parado desde
 *  a origem dos tempos. */
export function inicioDaContagem(chamado: ChamadoInatividade) {
  return (chamado.ultimaAcaoResponsavelEm ?? chamado.abertoEm).slice(0, 10);
}

/** Dias corridos, como o SLA do módulo — misturar com dias úteis daria duas
 *  aritméticas de data para o mesmo chamado. A conta é sobre strings
 *  "YYYY-MM-DD" em UTC: converter para Date local desloca o dia em fuso
 *  negativo e a etiqueta acenderia (ou apagaria) um dia fora da hora. */
export function diasSemMovimento(chamado: ChamadoInatividade, hoje = hojeIso()) {
  return diferencaEmDias(inicioDaContagem(chamado), hoje);
}

/** Concluído nunca recebe a etiqueta: parar é o desfecho esperado dele. */
export function semMovimento(
  chamado: ChamadoInatividade,
  diasLimite = DIAS_SEM_MOVIMENTO_PADRAO,
  hoje = hojeIso()
) {
  if (chamado.estagio === "concluido") return false;
  return diasSemMovimento(chamado, hoje) >= diasLimite;
}

/** Texto pronto da etiqueta, ou null quando ela não deve aparecer. As duas
 *  redações dizem coisas diferentes de propósito: "Parado" pressupõe que houve
 *  trabalho e ele esfriou; "Sem ação" diz que ninguém com posse começou. */
export function etiquetaInatividade(
  chamado: ChamadoInatividade,
  diasLimite = DIAS_SEM_MOVIMENTO_PADRAO,
  hoje = hojeIso()
) {
  if (!semMovimento(chamado, diasLimite, hoje)) return null;
  const dias = diasSemMovimento(chamado, hoje);
  return chamado.primeiraAcaoResponsavelEm
    ? `Parado há ${dias} dias`
    : `Sem ação há ${dias} dias`;
}

// --- Notificações --------------------------------------------------------

export const ROTULO_NOTIFICACAO: Record<Enums["TipoNotificacaoPosVenda"], string> = {
  // Emitido até a mudança para chamado direcionado. Continua no enum e no
  // rótulo por causa dos registros históricos, que ainda apontam para ele.
  chamado_novo: "Novo chamado",
  chamado_direcionado: "Chamado direcionado a você",
  responsavel_alterado: "Responsável alterado",
  chamado_sem_movimento: "Chamado parado",
  chamado_vencido: "Prazo vencido",
  chamado_atualizado: "Chamado atualizado",
  interacao_registrada: "Nova interação",
  conversa_sem_dono: "Conversa sem dono",
  conversa_atribuida: "Conversa atribuída a você",
};

export type NotificacaoItem = {
  id: string;
  // Nulo no aviso que não nasce de chamado — conversa de WhatsApp parada sem
  // dono, por exemplo. Quem consome decide para onde levar o usuário.
  chamadoId: string | null;
  conversaId: string | null;
  tipo: Enums["TipoNotificacaoPosVenda"];
  titulo: string;
  detalhe: string | null;
  lida: boolean;
  criadoEm: string;
  autor: string | null;
};

/** "agora", "há 12 min", "há 3 h", "há 2 d" — para a lista do sino. */
export function tempoRelativo(iso: string, agora = Date.now()) {
  const minutos = Math.floor((agora - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
}

// --- Anexos ---------------------------------------------------------------
// Ficam aqui, e não no actions.ts do módulo, porque o atendimento por WhatsApp
// também promove mídia a anexo e precisa obedecer ao mesmo limite: duas
// definições separadas divergiriam no primeiro ajuste.

export const BUCKET_ANEXOS = "pos-venda";
export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;

/** Sanitiza para o nome do objeto no bucket; o nome original vai para a coluna
 *  nomeArquivo e é o que o usuário vê. */
export function nomeSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-80);
}
