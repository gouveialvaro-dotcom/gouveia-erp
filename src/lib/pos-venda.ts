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

// --- Sem movimento -------------------------------------------------------
// Chamado parado é diferente de chamado atrasado: o prazo pode estar longe e o
// atendimento ter esfriado mesmo assim — são estados ortogonais, e um chamado
// pode estar nos dois. Como "a_vencer" e "vencido", este é um estado DERIVADO e
// não uma coluna gravada: uma coluna precisaria de um job para ser mantida e
// mentiria entre uma passada e outra, enquanto a data da última movimentação já
// está no banco e responde sozinha a qualquer momento.

export const DIAS_SEM_MOVIMENTO_PADRAO = 2;

export type ChamadoMovimento = {
  estagio: EstagioChamado;
  abertoEm: string;
  /** Data ("YYYY-MM-DD") da interação mais recente, se houver alguma. */
  ultimaInteracaoEm: string | null;
};

/** A mais recente entre a última interação e a abertura: sem esse piso, um
 *  chamado recém-aberto e ainda sem interação nenhuma contaria como parado
 *  desde a origem dos tempos. */
export function ultimaMovimentacao(chamado: ChamadoMovimento) {
  const abertura = chamado.abertoEm.slice(0, 10);
  const interacao = chamado.ultimaInteracaoEm?.slice(0, 10);
  if (!interacao) return abertura;
  return interacao > abertura ? interacao : abertura;
}

/** Dias corridos parados. A conta é sobre strings "YYYY-MM-DD" em UTC, como o
 *  resto do módulo: converter para Date local desloca o dia em fuso negativo e
 *  o destaque acenderia (ou apagaria) um dia fora da hora. */
export function diasSemMovimento(chamado: ChamadoMovimento, hoje = hojeIso()) {
  return diferencaEmDias(ultimaMovimentacao(chamado), hoje);
}

/** Concluído nunca entra no destaque: parar é o desfecho esperado dele. */
export function semMovimento(
  chamado: ChamadoMovimento,
  diasLimite = DIAS_SEM_MOVIMENTO_PADRAO,
  hoje = hojeIso()
) {
  if (chamado.estagio === "concluido") return false;
  return diasSemMovimento(chamado, hoje) >= diasLimite;
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
