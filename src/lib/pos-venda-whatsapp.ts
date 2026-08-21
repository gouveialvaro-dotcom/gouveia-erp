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

export const CAIXAS = ["pendentes", "minhas", "sem_dono", "sem_cliente", "todas"] as const;
export type Caixa = (typeof CAIXAS)[number];

export const ROTULO_CAIXA: Record<Caixa, string> = {
  pendentes: "Pendentes",
  minhas: "Minhas",
  sem_dono: "Sem dono",
  sem_cliente: "Sem cliente",
  todas: "Todas",
};

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
