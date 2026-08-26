// Constantes e regras do atendimento por WhatsApp. Vive fora de actions.ts
// porque um arquivo "use server" só pode exportar funções async — mesma razão
// de lib/pos-venda.ts. Nada aqui toca o banco: pode ser importado por Client
// Component sem arrastar o client de service role junto.

import type { Database } from "@/lib/database.types";
import type { EstagioChamado } from "@/lib/pos-venda";

type Enums = Database["public"]["Enums"];
export type DirecaoMensagem = Enums["DirecaoMensagemWhatsapp"];
export type TipoMensagem = Enums["TipoMensagemWhatsapp"];

export const ROTULO_TIPO_MENSAGEM: Record<TipoMensagem, string> = {
  texto: "Texto",
  imagem: "Imagem",
  documento: "Documento",
  audio: "Áudio",
};

// --- Caixas da lista de conversas ----------------------------------------

export const CAIXAS = [
  "pendentes",
  "minhas",
  "sem_dono",
  "sem_cliente",
  "todas",
  "arquivadas",
] as const;
export type Caixa = (typeof CAIXAS)[number];

export const ROTULO_CAIXA: Record<Caixa, string> = {
  pendentes: "Pendentes",
  minhas: "Minhas",
  sem_dono: "Sem dono",
  sem_cliente: "Sem cliente",
  todas: "Todas",
  arquivadas: "Arquivadas",
};

// Conversa arquivada some de todas as outras caixas — inclusive de "Todas",
// que significa "todas as ativas". Só a caixa "Arquivadas" e a busca a
// alcançam: arquivar é tirar da fila de trabalho, não do registro.
export function caixaMostraArquivadas(caixa: Caixa) {
  return caixa === "arquivadas";
}

export function caixaValida(valor: string | undefined): Caixa {
  return CAIXAS.includes(valor as Caixa) ? (valor as Caixa) : "pendentes";
}

// --- Telefone -------------------------------------------------------------
// O cadastro guarda telefone como texto livre, com máscara ("(31) 99999-8888"),
// e o WhatsApp entrega o número como jid ("5531999998888@s.whatsapp.net").
// Comparar os dois só funciona depois de reduzir ambos à mesma forma.

export function apenasDigitos(valor: string) {
  return valor.replace(/\D+/g, "");
}

/**
 * Chave canônica do número: "55" + DDD + os 8 dígitos finais.
 *
 * O nono dígito fica DE FORA de propósito. O mesmo cliente manda mensagem ora
 * de um aparelho que apresenta o número com 9, ora de um cadastro antigo sem
 * ele; se o 9 entrasse na chave, uma pessoa só viraria duas conversas, cada uma
 * com metade do histórico. Colidir com telefone fixo é improvável — celular sem
 * o 9 começa em 6–9 e fixo começa em 2–5.
 *
 * Devolve null para o que não dá para interpretar como telefone; número
 * estrangeiro passa sem tratamento do nono dígito (a regra é brasileira).
 */
export function chaveTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const digitos = apenasDigitos(bruto);
  if (digitos.length < 10) return null;

  let nacional: string;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    nacional = digitos.slice(2);
  } else if (digitos.length === 10 || digitos.length === 11) {
    nacional = digitos;
  } else {
    return digitos;
  }

  const ddd = nacional.slice(0, 2);
  let assinante = nacional.slice(2);
  if (assinante.length === 9 && assinante.startsWith("9")) {
    assinante = assinante.slice(1);
  }

  return `55${ddd}${assinante}`;
}

/** true quando os dois números são a mesma pessoa, com ou sem o nono dígito. */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined) {
  const chaveA = chaveTelefone(a);
  return chaveA !== null && chaveA === chaveTelefone(b);
}

/** "(31) 99999-8888" a partir de qualquer forma do número. */
export function formatarTelefone(bruto: string | null | undefined) {
  if (!bruto) return "—";
  let d = apenasDigitos(bruto);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}

/** Número no formato que o gateway espera no envio: só dígitos, com DDI. */
export function telefoneParaEnvio(telefoneExibicao: string) {
  const d = apenasDigitos(telefoneExibicao);
  return d.startsWith("55") ? d : `55${d}`;
}

// --- Tipo da mídia --------------------------------------------------------

export function tipoPorMime(mime: string | null | undefined): TipoMensagem {
  if (!mime) return "documento";
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("audio/")) return "audio";
  return "documento";
}

// --- Hora ----------------------------------------------------------------
// A mensagem é gravada em timestamptz (instante exato, em UTC) e não em string
// "YYYY-MM-DD" como o prazo do SLA: aqui a hora importa, e duas mensagens do
// mesmo dia precisam ordenar entre si. Na exibição o fuso é fixado em
// America/Sao_Paulo — o servidor da Vercel roda em UTC e, sem o timeZone
// explícito, a conversa apareceria três horas adiantada para todo mundo.

const FUSO = "America/Sao_Paulo";

export function formatarHoraBrasilia(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatarDataHoraBrasilia(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Data da mensagem para o separador de dia na conversa. */
export function diaBrasilia(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** Quanto tempo o cliente está esperando — ordena a fila de pendentes. */
export function tempoEspera(iso: string | null, agora = Date.now()) {
  if (!iso) return "—";
  const minutos = Math.floor((agora - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
}

// --- Marcação corrente do chamado ----------------------------------------

export type ChamadoDaConversa = { id: string; estagio: EstagioChamado } | null | undefined;

/**
 * Para qual chamado vai a PRÓXIMA mensagem desta conversa — null quando é para
 * ficar solta.
 *
 * Uma conversa acumula vários chamados ao longo do tempo, então o vínculo é por
 * mensagem e não da conversa inteira: o atendente aponta ("daqui em diante é
 * sobre o chamado X") e tudo que entra ou sai depois recebe esse chamado, até
 * ele trocar. Concluir o chamado solta a conversa sozinha — sem isso, a próxima
 * mensagem do cliente, que já é outro assunto, entraria num chamado encerrado.
 *
 * A mesma função decide no recebimento (webhook), no envio (server action) e na
 * faixa que a tela mostra, para os três nunca discordarem.
 */
export function chamadoCorrente(
  conversa: { chamadoAtivoId: string | null },
  chamadoAtivo: ChamadoDaConversa
): string | null {
  if (!conversa.chamadoAtivoId || !chamadoAtivo) return null;
  if (chamadoAtivo.estagio === "concluido") return null;
  return chamadoAtivo.id;
}

// --- Limites --------------------------------------------------------------

/** Tamanho máximo que o gateway aceita receber de mídia por mensagem. */
export const TAMANHO_MAXIMO_MIDIA = 16 * 1024 * 1024;

export function formatarTamanho(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// --- Horário comercial ----------------------------------------------------
// Existe para medir "2 horas úteis" de conversa parada. A jornada vem de
// ParametroGeral e nunca é fixada aqui: quem muda o horário da empresa é o
// cadastro, não um deploy.

export type HorarioComercial = {
  horaInicioComercial: string; // "HH:MM[:SS]"
  horaFimComercial: string;
  diasSemanaComercial: number[]; // ISO-8601: 1 = segunda … 7 = domingo
};

const FUSO_COMERCIAL = "America/Sao_Paulo";

/** Minutos desde a meia-noite de uma coluna `time` do Postgres. */
function minutosDoDia(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

// O expediente é contado no fuso de Brasília, não no do servidor: a Vercel roda
// em UTC e, sem isso, o expediente das 8h começaria às 5h da manhã para o time.
function partesEmBrasilia(data: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_COMERCIAL,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(data);

  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const diaIso =
    { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 }[
      pegar("weekday").toLowerCase().slice(0, 3)
    ] ?? 1;

  return { diaIso, minutos: Number(pegar("hour")) * 60 + Number(pegar("minute")) };
}

/**
 * Minutos de expediente entre dois instantes.
 *
 * Percorre em passos de 15 minutos em vez de calcular por fórmula fechada. O
 * intervalo aqui é sempre curto — a verificação roda sobre conversas do dia,
 * comparando contra um limite de 2 horas — e a fórmula fechada precisaria
 * tratar virada de dia, fim de semana e jornada partida, que é onde esse tipo
 * de conta costuma errar em silêncio.
 */
export function minutosUteisEntre(de: Date, ate: Date, horario: HorarioComercial) {
  if (ate <= de) return 0;

  const inicio = minutosDoDia(horario.horaInicioComercial);
  const fim = minutosDoDia(horario.horaFimComercial);
  const dias = new Set(horario.diasSemanaComercial);

  const PASSO = 15;
  let uteis = 0;
  let cursor = de.getTime();
  const limite = ate.getTime();

  // Teto de segurança: 60 dias de varredura. Uma conversa esquecida por mais
  // tempo que isso já estourou qualquer limite que se queira medir.
  const tetoIteracoes = (60 * 24 * 60) / PASSO;

  for (let i = 0; cursor < limite && i < tetoIteracoes; i++) {
    const { diaIso, minutos } = partesEmBrasilia(new Date(cursor));
    if (dias.has(diaIso) && minutos >= inicio && minutos < fim) {
      uteis += Math.min(PASSO, (limite - cursor) / 60_000);
    }
    cursor += PASSO * 60_000;
  }

  return Math.round(uteis);
}

/** Limite a partir do qual a conversa pendente sem dono vira aviso. */
export const MINUTOS_UTEIS_SEM_DONO = 120;

// --- Envio ativo ----------------------------------------------------------

// Escrever para quem não fala com a empresa há mais de um dia é envio ativo, e
// é o comportamento que mais leva ao bloqueio do número pela Meta. A tela avisa
// antes; a trava dura é o teto diário de ParametroGeral.
export const HORAS_SILENCIO_PARA_AVISO = 24;

export function ehEnvioAtivo(ultimaEntradaEm: string | null, agora = Date.now()) {
  if (!ultimaEntradaEm) return true;
  return agora - new Date(ultimaEntradaEm).getTime() > HORAS_SILENCIO_PARA_AVISO * 3_600_000;
}

// --- Envio de arquivo -----------------------------------------------------

/**
 * Teto do arquivo que sai pela tela.
 *
 * Não é limite do WhatsApp (que aceita mais), e sim do caminho: o upload sobe
 * por Server Action, e next.config fixa serverActions.bodySizeLimit em 11 MB
 * para cobrir o overhead do multipart. Passar disso derruba a requisição antes
 * de qualquer validação nossa rodar, com erro que não diz nada ao usuário.
 */
export const TAMANHO_MAXIMO_ENVIO = 10 * 1024 * 1024;

/** O que o campo de arquivo oferece. Vídeo fica de fora da Fase 3: o limite de
 *  10 MB do caminho tornaria quase todo vídeo de celular inviável, e prometer
 *  na interface o que falha na hora é pior que não oferecer. */
export const TIPOS_ACEITOS_ENVIO =
  "image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";

/**
 * Traduz o nosso tipo para o da uazapi.
 *
 * `ehVoz` separa a gravação feita na tela do arquivo de áudio anexado: a
 * primeira vira "ptt" e chega como mensagem de voz, com onda e play; a segunda
 * vira "audio" e chega como arquivo. Para o cliente são coisas visivelmente
 * diferentes.
 */
export function tipoParaGateway(tipo: TipoMensagem, ehVoz = false) {
  if (tipo === "imagem") return "image" as const;
  if (tipo === "audio") return ehVoz ? ("ptt" as const) : ("audio" as const);
  return "document" as const;
}
