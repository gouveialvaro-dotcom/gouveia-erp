import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import { urlDaMidia, baixarArquivo } from "@/lib/uazapi";
import { nomeSeguro } from "@/lib/pos-venda";
import {
  chamadoCorrente,
  chaveTelefone,
  formatarTelefone,
  mesmoTelefone,
  tipoPorMime,
  type DirecaoMensagem,
  type TipoMensagem,
} from "@/lib/pos-venda-whatsapp";

// Entrada das mensagens vindas do gateway (uazapi).
//
// Esta rota NÃO passa pelo middleware: o matcher de src/proxy.ts exclui "api",
// e o gateway não tem sessão de usuário para apresentar. Quem protege é o
// segredo compartilhado conferido logo abaixo — sem ele, qualquer um na
// internet publicaria mensagem falsa dentro do ERP.

const BUCKET_MIDIA = "whatsapp";
const SEGREDO = process.env.WHATSAPP_WEBHOOK_SECRET ?? "";

// Comparação em tempo constante: comparar com === vaza, pelo tempo de resposta,
// quantos caracteres iniciais do segredo o atacante já acertou.
function segredoConfere(recebido: string | null) {
  if (!SEGREDO || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(SEGREDO);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// O provedor muda nome de campo entre versões e não versiona o payload. Em vez
// de fixar um formato, cada dado é procurado nos apelidos conhecidos — e o
// corpo cru vai inteiro para a coluna "payload", que é a rede de segurança se
// algum campo novo aparecer.
type Carga = Record<string, unknown>;

function objeto(valor: unknown): Carga | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Carga)
    : null;
}

function texto(fonte: Carga | null, ...campos: string[]): string | null {
  if (!fonte) return null;
  for (const campo of campos) {
    const valor = fonte[campo];
    if (typeof valor === "string" && valor.trim() !== "") return valor;
    if (typeof valor === "number") return String(valor);
  }
  return null;
}

function numero(fonte: Carga | null, ...campos: string[]): number | null {
  if (!fonte) return null;
  for (const campo of campos) {
    const valor = fonte[campo];
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    if (typeof valor === "string" && valor.trim() !== "" && !Number.isNaN(Number(valor))) {
      return Number(valor);
    }
  }
  return null;
}

function booleano(fonte: Carga | null, ...campos: string[]): boolean {
  if (!fonte) return false;
  for (const campo of campos) {
    const valor = fonte[campo];
    if (typeof valor === "boolean") return valor;
    if (valor === "true") return true;
  }
  return false;
}

/** Extrai da carga o que interessa, seja qual for o formato que o gateway usar. */
function lerMensagem(corpo: Carga) {
  const mensagem =
    objeto(corpo.message) ??
    objeto(corpo.data) ??
    (Array.isArray(corpo.messages) ? objeto(corpo.messages[0]) : null) ??
    corpo;

  const chave = objeto(mensagem.key);

  const jid =
    texto(mensagem, "chatid", "chatId", "from", "sender", "remoteJid", "cleanedSenderPn") ??
    texto(chave, "remoteJid");

  const conteudo =
    texto(mensagem, "text", "body", "conversation", "caption", "messageBody") ??
    texto(objeto(mensagem.content), "text", "caption");

  return {
    jid,
    conteudo,
    idExterno: texto(mensagem, "messageid", "messageId", "id") ?? texto(chave, "id"),
    daEmpresa: booleano(mensagem, "fromMe", "isFromMe") || booleano(chave, "fromMe"),
    nomePerfil: texto(mensagem, "senderName", "pushName", "notifyName", "chatName"),
    // Segundos (padrão do WhatsApp) ou milissegundos, conforme o gateway.
    carimbo: numero(mensagem, "messageTimestamp", "timestamp", "t", "momment"),
    tipoBruto: texto(mensagem, "mediaType", "messageType", "type"),
    mime: texto(mensagem, "mimetype", "mimeType", "mime"),
    arquivoUrl: texto(mensagem, "fileURL", "fileUrl", "url", "file", "mediaUrl"),
    nomeArquivo: texto(mensagem, "fileName", "filename", "documentName"),
    tamanho: numero(mensagem, "fileLength", "size", "fileSize"),
  };
}

function instanteDaMensagem(carimbo: number | null) {
  if (!carimbo) return new Date().toISOString();
  // Carimbo do WhatsApp vem em segundos; qualquer coisa acima disso já é ms.
  const ms = carimbo > 1e12 ? carimbo : carimbo * 1000;
  return new Date(ms).toISOString();
}

function tipoDaMensagem(tipoBruto: string | null, mime: string | null): TipoMensagem {
  const bruto = (tipoBruto ?? "").toLowerCase();
  if (bruto.includes("image") || bruto.includes("sticker")) return "imagem";
  if (bruto.includes("audio") || bruto.includes("ptt") || bruto.includes("voice")) return "audio";
  if (bruto.includes("document") || bruto.includes("video")) return "documento";
  if (mime) return tipoPorMime(mime);
  return "texto";
}

/**
 * Casa o telefone com o cadastro. Roda só quando a conversa ainda não tem
 * cliente: o vínculo feito à mão por um atendente vale mais que qualquer
 * casamento automático e não pode ser desfeito por ele.
 *
 * A comparação é em memória, e não no SQL, porque o telefone do cadastro é
 * texto livre com máscara — não existe forma de comparar no banco sem antes
 * normalizar os dois lados (ver chaveTelefone). A base de clientes é pequena;
 * se um dia deixar de ser, o caminho é uma coluna normalizada com índice.
 */
async function casarCliente(chave: string) {
  const [{ data: clientes }, { data: contatos }] = await Promise.all([
    supabase.from("Cliente").select("id, telefone").not("telefone", "is", null),
    supabase
      .from("ContatoCliente")
      .select("id, clienteId, telefone")
      .not("telefone", "is", null),
  ]);

  const contato = (contatos ?? []).find((c) => mesmoTelefone(chave, c.telefone));
  if (contato) return { clienteId: contato.clienteId, contatoClienteId: contato.id };

  const cliente = (clientes ?? []).find((c) => mesmoTelefone(chave, c.telefone));
  if (cliente) return { clienteId: cliente.id, contatoClienteId: null };

  // Sem casamento a conversa cai na caixa "Sem cliente". Ela não some e não é
  // descartada: fica lá até alguém do atendimento fazer o vínculo.
  return { clienteId: null, contatoClienteId: null };
}

const SELECT_CONVERSA =
  "id, clienteId, chamadoAtivoId, nomePerfil, chamadoAtivo:Chamado(id, estagio)";

async function conversaDoTelefone(chave: string, telefoneExibicao: string) {
  const { data: existente } = await supabase
    .from("ConversaWhatsapp")
    .select(SELECT_CONVERSA)
    .eq("telefone", chave)
    .maybeSingle();

  if (existente) return existente;

  const vinculo = await casarCliente(chave);
  const { data: criada } = await supabase
    .from("ConversaWhatsapp")
    .insert({ telefone: chave, telefoneExibicao, ...vinculo })
    .select(SELECT_CONVERSA)
    .single();

  return criada;
}

/** Sobe a mídia recebida para o bucket privado "whatsapp". */
async function guardarMidia(
  conversaId: string,
  dados: { arquivoUrl: string | null; idExterno: string | null; nomeArquivo: string | null; mime: string | null }
) {
  const url = dados.arquivoUrl ?? (dados.idExterno ? await urlDaMidia(dados.idExterno) : null);
  if (!url) return null;

  const arquivo = await baixarArquivo(url);
  if (!arquivo) return null;

  const mime = dados.mime ?? arquivo.mime;
  const nome = dados.nomeArquivo ?? `midia-${Date.now()}`;
  const caminho = `${conversaId}/${crypto.randomUUID()}-${nomeSeguro(nome)}`;

  const { error } = await supabase.storage
    .from(BUCKET_MIDIA)
    .upload(caminho, arquivo.bytes, { contentType: mime ?? undefined });

  if (error) return null;

  return {
    caminhoStorage: caminho,
    nomeArquivo: nome,
    tamanho: arquivo.bytes.byteLength,
    mime,
  };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const apresentado =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-webhook-token") ??
    url.searchParams.get("segredo");

  if (!segredoConfere(apresentado)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let corpo: Carga;
  try {
    corpo = (await request.json()) as Carga;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const dados = lerMensagem(corpo);

  // Só interessa evento de mensagem. Confirmação de entrega, mudança de status
  // da conexão e leitura de QR chegam pela mesma URL e são ignoradas — mas com
  // 200, senão o gateway fica reenviando o mesmo evento para sempre.
  if (!dados.jid) {
    return NextResponse.json({ ok: true, ignorado: "evento sem telefone" });
  }

  // Grupo fica de fora da Fase 1: a conversa aqui é entre a empresa e um
  // cliente, e o vínculo com Cliente pressupõe um telefone, não vários.
  if (dados.jid.includes("@g.us")) {
    return NextResponse.json({ ok: true, ignorado: "mensagem de grupo" });
  }

  const chave = chaveTelefone(dados.jid);
  if (!chave) {
    return NextResponse.json({ ok: true, ignorado: "telefone ilegível" });
  }

  // O gateway reenvia o evento quando não recebe 2xx a tempo, e a mensagem que
  // nós mesmos enviamos volta pelo webhook marcada como fromMe. Sem esta trava
  // a conversa duplicaria em ambos os casos.
  if (dados.idExterno) {
    const { data: jaExiste } = await supabase
      .from("MensagemWhatsapp")
      .select("id")
      .eq("mensagemExternaId", dados.idExterno)
      .maybeSingle();

    if (jaExiste) return NextResponse.json({ ok: true, duplicada: true });
  }

  const conversa = await conversaDoTelefone(chave, formatarTelefone(dados.jid));
  if (!conversa) {
    return NextResponse.json({ erro: "Falha ao registrar a conversa." }, { status: 500 });
  }

  const direcao: DirecaoMensagem = dados.daEmpresa ? "saida" : "entrada";
  const tipo = tipoDaMensagem(dados.tipoBruto, dados.mime);

  const midia =
    tipo === "texto"
      ? null
      : await guardarMidia(conversa.id, {
          arquivoUrl: dados.arquivoUrl,
          idExterno: dados.idExterno,
          nomeArquivo: dados.nomeArquivo,
          mime: dados.mime,
        });

  const recebidoEm = instanteDaMensagem(dados.carimbo);

  const { error } = await supabase.from("MensagemWhatsapp").insert({
    conversaId: conversa.id,
    direcao,
    tipo,
    conteudo: dados.conteudo,
    // Mensagem que a empresa mandou pelo celular, fora do sistema, não tem
    // autor identificável — fica sem enviadoPorId, mas fica registrada.
    enviadoPorId: null,
    chamadoId: chamadoCorrente(conversa, conversa.chamadoAtivo),
    caminhoStorage: midia?.caminhoStorage ?? null,
    nomeArquivo: midia?.nomeArquivo ?? null,
    tamanho: midia?.tamanho ?? null,
    mime: midia?.mime ?? null,
    mensagemExternaId: dados.idExterno,
    // O corpo cru é gravado como veio: se o gateway mandar um campo que o
    // mapeamento acima ainda não conhece, ele não se perde.
    payload: corpo as Json,
    recebidoEm,
  });

  // 23505 = a mesma mensagem entrou por uma entrega paralela do gateway entre a
  // checagem acima e este insert. Não é erro: o registro já está lá.
  if (error && error.code !== "23505") {
    console.error("Falha ao gravar mensagem de WhatsApp", error);
    return NextResponse.json({ erro: "Falha ao gravar a mensagem." }, { status: 500 });
  }

  await supabase
    .from("ConversaWhatsapp")
    .update({
      // Pendente é "a última mensagem é do cliente". Responder — pela tela ou
      // pelo celular — tira a conversa da fila.
      pendente: direcao === "entrada",
      ultimaMensagemEm: recebidoEm,
      ultimaMensagemDirecao: direcao,
      nomePerfil: dados.nomePerfil ?? conversa.nomePerfil,
      atualizadoEm: new Date().toISOString(),
    })
    .eq("id", conversa.id);

  revalidatePath("/pos-venda/whatsapp");

  return NextResponse.json({ ok: true });
}
