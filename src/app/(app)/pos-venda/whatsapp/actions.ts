"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirAdmin, exigirPermissao } from "@/lib/api-auth";
import { BUCKET_ANEXOS, TAMANHO_MAXIMO_ANEXO, nomeSeguro } from "@/lib/pos-venda";
import { chamadoCorrente, telefoneParaEnvio } from "@/lib/pos-venda-whatsapp";
import { enviarTexto } from "@/lib/uazapi";

const BUCKET_MIDIA = "whatsapp";

const SELECT_CONVERSA =
  "id, telefoneExibicao, clienteId, chamadoAtivoId, chamadoAtivo:Chamado(id, estagio)";

function revalidar() {
  revalidatePath("/pos-venda/whatsapp");
}

async function carregarConversa(conversaId: string) {
  const { data } = await supabase
    .from("ConversaWhatsapp")
    .select(SELECT_CONVERSA)
    .eq("id", conversaId)
    .maybeSingle();

  return data;
}

// --- Envio ---------------------------------------------------------------

export type EstadoEnvio = { erro?: string } | undefined;

const envioSchema = z.object({
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4096, "Mensagem longa demais."),
});

export async function enviarMensagem(
  conversaId: string,
  _estado: EstadoEnvio,
  formData: FormData
): Promise<EstadoEnvio> {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const dados = envioSchema.safeParse({ texto: formData.get("texto") });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const conversa = await carregarConversa(conversaId);
  if (!conversa) return { erro: "Conversa não encontrada." };

  const agora = new Date().toISOString();

  // A mensagem é gravada ANTES de sair. O número é de API não oficial e pode
  // cair a qualquer momento; se a gravação dependesse da resposta do gateway,
  // uma queda apagaria o registro do que a empresa combinou com o cliente —
  // exatamente o que esta tela existe para impedir.
  const { data: gravada, error: erroGravacao } = await supabase
    .from("MensagemWhatsapp")
    .insert({
      conversaId,
      direcao: "saida",
      tipo: "texto",
      conteudo: dados.data.texto,
      enviadoPorId: usuarioId,
      // A marcação corrente vale para o que sai daqui em diante, nunca para
      // trás (ver chamadoCorrente).
      chamadoId: chamadoCorrente(conversa, conversa.chamadoAtivo),
      entregue: false,
      recebidoEm: agora,
    })
    .select("id")
    .single();

  if (erroGravacao || !gravada) return { erro: "Não foi possível registrar a mensagem." };

  const envio = await enviarTexto(telefoneParaEnvio(conversa.telefoneExibicao), dados.data.texto);

  await supabase
    .from("MensagemWhatsapp")
    .update({
      entregue: envio.ok,
      erroEnvio: envio.ok ? null : envio.erro,
      // Guardar o id do provedor é o que impede a nossa própria mensagem de
      // entrar de novo quando ela volta pelo webhook marcada como fromMe.
      mensagemExternaId: envio.ok ? envio.idExterno : null,
    })
    .eq("id", gravada.id);

  await supabase
    .from("ConversaWhatsapp")
    .update({
      pendente: false,
      ultimaMensagemEm: agora,
      ultimaMensagemDirecao: "saida",
      atualizadoEm: agora,
    })
    .eq("id", conversaId);

  revalidar();

  if (!envio.ok) {
    return { erro: `Mensagem registrada, mas o envio falhou: ${envio.erro}` };
  }
}

// --- Dono ----------------------------------------------------------------

/**
 * Assume a conversa. Qualquer usuário com escrita em posVenda pode assumir a de
 * outro, sem passar pelo admin: quando o dono está fora, o cliente não pode
 * ficar esperando alguém liberar o atendimento.
 */
export async function assumirConversa(conversaId: string) {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  await supabase
    .from("ConversaWhatsapp")
    .update({ donoId: usuarioId, atualizadoEm: new Date().toISOString() })
    .eq("id", conversaId);

  revalidar();
}

// --- Pendência -----------------------------------------------------------

export async function marcarPendencia(conversaId: string, pendente: boolean) {
  await exigirPermissao("posVenda", "escrita");

  await supabase
    .from("ConversaWhatsapp")
    .update({ pendente, atualizadoEm: new Date().toISOString() })
    .eq("id", conversaId);

  revalidar();
}

// --- Vínculo com o cliente -----------------------------------------------

const vinculoSchema = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  contatoClienteId: z.string().optional(),
});

export type EstadoVinculo = { erro?: string } | undefined;

/**
 * Vincula a conversa a um cliente. O vínculo persiste no telefone: a próxima
 * mensagem do mesmo número já cai no cliente certo, porque o webhook só tenta
 * casar automaticamente quando clienteId ainda é nulo.
 *
 * Ler o cadastro do cliente é permissão do módulo "clientes", mas o atendimento
 * tem apenas leitura lá e escrita em posVenda — quem autoriza a gravação aqui é
 * posVenda, que é de quem a conversa é.
 */
export async function vincularCliente(
  conversaId: string,
  _estado: EstadoVinculo,
  formData: FormData
): Promise<EstadoVinculo> {
  await exigirPermissao("posVenda", "escrita");

  const dados = vinculoSchema.safeParse({
    clienteId: formData.get("clienteId"),
    contatoClienteId: formData.get("contatoClienteId") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: cliente } = await supabase
    .from("Cliente")
    .select("id")
    .eq("id", dados.data.clienteId)
    .maybeSingle();

  if (!cliente) return { erro: "Cliente não encontrado." };

  // Trocar de cliente com um chamado marcado deixaria a conversa apontando para
  // o chamado de outra empresa; a marcação cai junto.
  const { error } = await supabase
    .from("ConversaWhatsapp")
    .update({
      clienteId: dados.data.clienteId,
      contatoClienteId: dados.data.contatoClienteId ?? null,
      chamadoAtivoId: null,
      atualizadoEm: new Date().toISOString(),
    })
    .eq("id", conversaId);

  if (error) return { erro: "Não foi possível vincular o cliente." };

  revalidar();
}

// --- Marcação do chamado -------------------------------------------------

export type EstadoMarcacao = { erro?: string } | undefined;

/**
 * Aponta a conversa para um chamado — ou solta (chamadoId vazio).
 *
 * Vale da marcação para a frente. As mensagens anteriores continuam como
 * estavam: vincular retroativamente jogaria conversa de um assunto dentro de
 * outro, que é justamente o erro que a faixa fixa da tela existe para evitar.
 */
export async function marcarChamado(
  conversaId: string,
  _estado: EstadoMarcacao,
  formData: FormData
): Promise<EstadoMarcacao> {
  await exigirPermissao("posVenda", "escrita");

  const chamadoId = String(formData.get("chamadoId") ?? "").trim();
  const conversa = await carregarConversa(conversaId);
  if (!conversa) return { erro: "Conversa não encontrada." };

  if (chamadoId === "") {
    await supabase
      .from("ConversaWhatsapp")
      .update({ chamadoAtivoId: null, atualizadoEm: new Date().toISOString() })
      .eq("id", conversaId);
    revalidar();
    return;
  }

  const { data: chamado } = await supabase
    .from("Chamado")
    .select("id, clienteId, estagio")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!chamado) return { erro: "Chamado não encontrado." };

  // Apontar para chamado de outro cliente é sempre engano de digitação, e o
  // estrago aparece depois, com mensagem de um cliente no histórico de outro.
  if (chamado.clienteId !== conversa.clienteId) {
    return { erro: "O chamado é de outro cliente." };
  }
  if (chamado.estagio === "concluido") {
    return { erro: "O chamado já foi concluído — abra um novo antes de marcar." };
  }

  await supabase
    .from("ConversaWhatsapp")
    .update({ chamadoAtivoId: chamado.id, atualizadoEm: new Date().toISOString() })
    .eq("id", conversaId);

  revalidar();
}

// --- Promoção de mídia a anexo do chamado --------------------------------

export type EstadoPromocao = { erro?: string } | undefined;

/**
 * Copia a mídia da conversa para o bucket do pós-venda e cria o AnexoChamado.
 *
 * É cópia e não movimentação: o arquivo continua na conversa, que é o registro
 * do que o cliente mandou, e passa a existir também no chamado, sob as regras
 * que já valem para anexo (10 MB, bucket "pos-venda").
 */
export async function promoverParaAnexo(
  conversaId: string,
  mensagemId: string
): Promise<EstadoPromocao> {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const { data: mensagem } = await supabase
    .from("MensagemWhatsapp")
    .select("id, chamadoId, caminhoStorage, nomeArquivo, tamanho, mime")
    .eq("id", mensagemId)
    .maybeSingle();

  if (!mensagem?.caminhoStorage) return { erro: "Esta mensagem não tem arquivo." };

  const conversa = await carregarConversa(conversaId);
  const chamadoId = mensagem.chamadoId ?? chamadoCorrente(conversa!, conversa?.chamadoAtivo);

  if (!chamadoId) {
    return { erro: "Aponte a conversa para um chamado antes de promover o arquivo." };
  }

  if ((mensagem.tamanho ?? 0) > TAMANHO_MAXIMO_ANEXO) {
    return { erro: "Arquivo maior que 10MB — acima do limite do anexo de chamado." };
  }

  const { data: arquivo, error: erroDownload } = await supabase.storage
    .from(BUCKET_MIDIA)
    .download(mensagem.caminhoStorage);

  if (erroDownload || !arquivo) return { erro: "Falha ao ler o arquivo da conversa." };

  const nome = mensagem.nomeArquivo ?? "arquivo-whatsapp";
  const caminho = `${chamadoId}/${crypto.randomUUID()}-${nomeSeguro(nome)}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .upload(caminho, arquivo, { contentType: mensagem.mime ?? undefined });

  if (erroUpload) return { erro: "Falha ao enviar o arquivo para o chamado." };

  const { error } = await supabase.from("AnexoChamado").insert({
    chamadoId,
    nomeArquivo: nome,
    caminho,
    tipoMime: mensagem.mime,
    tamanho: mensagem.tamanho,
    enviadoPorId: usuarioId,
  });

  // Sem o registro no banco o objeto vira lixo invisível no bucket.
  if (error) {
    await supabase.storage.from(BUCKET_ANEXOS).remove([caminho]);
    return { erro: "Falha ao registrar o anexo." };
  }

  revalidatePath(`/pos-venda/${chamadoId}`);
  revalidar();
}

// --- Arquivar e reabrir ---------------------------------------------------

/**
 * Arquivar tira a conversa da fila de trabalho — nunca do registro. Não existe
 * exclusão em nenhum caminho desta tela: preservar o que foi combinado com o
 * cliente é a razão de a página existir.
 *
 * Qualquer usuário com escrita em posVenda arquiva, não só o dono: conversa
 * encerrada esperando o dono voltar de férias é fila entupida sem motivo.
 */
export async function arquivarConversa(conversaId: string) {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  await supabase
    .from("ConversaWhatsapp")
    .update({
      arquivadaEm: new Date().toISOString(),
      arquivadaPorId: usuarioId,
      // Arquivar encerra o assunto corrente. Deixar a marcação de pé faria a
      // próxima mensagem, meses depois, cair num chamado que ninguém lembra.
      chamadoAtivoId: null,
      atualizadoEm: new Date().toISOString(),
    })
    .eq("id", conversaId);

  revalidar();
}

/** Traz a conversa de volta para a lista. Também acontece sozinho no webhook,
 *  quando o cliente escreve de novo (ver api/whatsapp/webhook). */
export async function reabrirConversa(conversaId: string) {
  await exigirPermissao("posVenda", "escrita");

  await supabase
    .from("ConversaWhatsapp")
    .update({
      arquivadaEm: null,
      arquivadaPorId: null,
      atualizadoEm: new Date().toISOString(),
    })
    .eq("id", conversaId);

  revalidar();
}

// --- Higiene: ocultar mensagem -------------------------------------------

export type EstadoOcultacao = { erro?: string } | undefined;

/**
 * Tira da vista mensagem que não é atendimento — teste técnico, número interno.
 * Restrita ao admin, e reversível: a linha continua no banco com o registro de
 * quem ocultou.
 *
 * Mensagem já vinculada a chamado nunca é ocultada. Ela é prova do que foi
 * combinado dentro de um atendimento formal; sumir com ela da conversa deixaria
 * o histórico do chamado mentindo por omissão.
 */
export async function ocultarMensagem(
  conversaId: string,
  mensagemId: string
): Promise<EstadoOcultacao> {
  const { usuarioId } = await exigirAdmin("posVenda");

  const { data: mensagem } = await supabase
    .from("MensagemWhatsapp")
    .select("id, chamadoId")
    .eq("id", mensagemId)
    .maybeSingle();

  if (!mensagem) return { erro: "Mensagem não encontrada." };
  if (mensagem.chamadoId) {
    return { erro: "Mensagem vinculada a chamado não pode ser ocultada." };
  }

  await supabase
    .from("MensagemWhatsapp")
    .update({ ocultaEm: new Date().toISOString(), ocultaPorId: usuarioId })
    .eq("id", mensagemId);

  revalidar();
}

export async function exibirMensagem(conversaId: string, mensagemId: string) {
  await exigirAdmin("posVenda");

  await supabase
    .from("MensagemWhatsapp")
    .update({ ocultaEm: null, ocultaPorId: null })
    .eq("id", mensagemId);

  revalidar();
}
