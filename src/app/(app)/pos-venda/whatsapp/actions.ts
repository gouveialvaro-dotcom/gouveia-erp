"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirAdmin, exigirPermissao } from "@/lib/api-auth";
import { BUCKET_ANEXOS, TAMANHO_MAXIMO_ANEXO, nomeSeguro } from "@/lib/pos-venda";
import {
  TAMANHO_MAXIMO_ENVIO,
  chamadoCorrente,
  chaveTelefone,
  formatarTelefone,
  telefoneParaEnvio,
  tipoParaGateway,
  tipoPorMime,
} from "@/lib/pos-venda-whatsapp";
import { enviarMidia, enviarTexto } from "@/lib/uazapi";
import { donoDoTelefone, gravarTelefoneNaFicha } from "@/lib/whatsapp-cadastro";
import { notificarConversa } from "@/lib/notificacoes-pos-venda";
import { podeEscrever, type Perfil } from "@/lib/permissoes";

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
  // Nome de quem fala por este número. Vira um ContatoCliente quando o cliente
  // já tem telefone principal preenchido.
  nomeContato: z.string().trim().max(120).optional(),
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

  const conversa = await carregarConversa(conversaId);
  if (!conversa) return { erro: "Conversa não encontrada." };

  const { data: cliente } = await supabase
    .from("Cliente")
    .select("id, razaoSocial")
    .eq("id", dados.data.clienteId)
    .maybeSingle();

  if (!cliente) return { erro: "Cliente não encontrado." };

  // Número já cadastrado para outra empresa é quase sempre engano de digitação.
  // Sobrescrever em silêncio faria a conversa de um cliente aparecer no
  // histórico de outro — avisa e bloqueia.
  const dono = await donoDoTelefone(conversa.telefoneExibicao);
  if (dono && dono.clienteId !== dados.data.clienteId) {
    return {
      erro:
        `Este telefone já está cadastrado para ${dono.clienteNome}` +
        `${dono.contatoNome ? ` (contato ${dono.contatoNome})` : ""}. ` +
        "Corrija a ficha do cliente antes de vincular.",
    };
  }

  // Armazenamento único: vincular pela tela do WhatsApp grava o telefone na
  // ficha do cliente. Não existe segunda lista de números dentro do módulo.
  const contatoCriadoId = await gravarTelefoneNaFicha(
    dados.data.clienteId,
    conversa.telefoneExibicao,
    dados.data.nomeContato || "Contato do WhatsApp"
  );

  // Trocar de cliente com um chamado marcado deixaria a conversa apontando para
  // o chamado de outra empresa; a marcação cai junto.
  const { error } = await supabase
    .from("ConversaWhatsapp")
    .update({
      clienteId: dados.data.clienteId,
      contatoClienteId: dados.data.contatoClienteId || contatoCriadoId || null,
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

// --- Distribuição pelo admin ---------------------------------------------

export type EstadoAtribuicao = { erro?: string } | undefined;

const atribuicaoSchema = z.object({
  donoId: z.string().min(1, "Selecione o atendente."),
  conversaIds: z.array(z.string().min(1)).min(1, "Selecione ao menos uma conversa."),
});

/**
 * Atribui conversas sem dono a um atendente. Restrita ao admin — é a única
 * forma de dono que alguém recebe sem ter pedido.
 *
 * Não substitui a regra geral: qualquer atendente continua podendo assumir a
 * conversa de outro sem passar por aqui. Esta ação existe para o começo do dia,
 * quando a fila chegou e ninguém puxou nada.
 */
export async function atribuirConversas(
  _estado: EstadoAtribuicao,
  formData: FormData
): Promise<EstadoAtribuicao> {
  const { usuarioId } = await exigirAdmin("posVenda");

  const dados = atribuicaoSchema.safeParse({
    donoId: formData.get("donoId"),
    conversaIds: formData.getAll("conversaIds").map(String),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: destinatario } = await supabase
    .from("Usuario")
    .select("id, nome, perfil, ativo")
    .eq("id", dados.data.donoId)
    .maybeSingle();

  if (!destinatario?.ativo) return { erro: "Atendente não encontrado ou inativo." };

  // Atribuir a quem não pode responder deixaria a conversa parada com dono —
  // pior que sem dono, porque some da caixa "Sem dono" e ninguém mais olha.
  if (!podeEscrever(destinatario.perfil as Perfil, "posVenda")) {
    return { erro: `${destinatario.nome} não tem permissão para responder no pós-venda.` };
  }

  const { data: atribuidas, error } = await supabase
    .from("ConversaWhatsapp")
    .update({ donoId: destinatario.id, atualizadoEm: new Date().toISOString() })
    .in("id", dados.data.conversaIds)
    .select("id, telefoneExibicao, cliente:Cliente(razaoSocial)");

  if (error) return { erro: "Não foi possível atribuir as conversas." };

  // O atendente precisa saber que passou a ser dono de algo — senão a
  // atribuição é só uma coluna trocada no banco.
  for (const conversa of atribuidas ?? []) {
    await notificarConversa({
      usuarioId: destinatario.id,
      conversaId: conversa.id,
      tipo: "conversa_atribuida",
      titulo: "Conversa atribuída a você",
      detalhe: conversa.cliente?.razaoSocial ?? conversa.telefoneExibicao,
      referencia: new Date().toISOString(),
      autorId: usuarioId,
    });
  }

  revalidar();
}

// --- Envio ativo ----------------------------------------------------------

export type EstadoIniciar = { erro?: string } | undefined;

const iniciarSchema = z.object({
  telefone: z.string().trim().min(10, "Informe o telefone com DDD."),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4096, "Mensagem longa demais."),
});

/** Início do dia de hoje no fuso de Brasília, em ISO — recorte do teto diário. */
function inicioDoDiaBrasilia() {
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  // -03:00 é o offset de Brasília, que não tem horário de verão desde 2019.
  return `${hoje}T00:00:00-03:00`;
}

/**
 * Inicia conversa com quem não escreveu — envio ativo.
 *
 * Liberado por decisão do sócio-diretor, com o risco assumido. O risco é
 * concreto: a conexão é por API não oficial sobre o número corporativo, e
 * mandar mensagem para quem não falou com a empresa recentemente é o
 * comportamento que mais leva ao bloqueio permanente do número pela Meta, sem
 * aviso e sem recurso.
 *
 * Por isso o teto diário, que é barato e removível. Ele NÃO é uma regra de
 * negócio da empresa — é contenção técnica de um risco de infraestrutura, e
 * mora em ParametroGeral para poder ser afrouxado sem deploy depois de ver o
 * número aguentar.
 *
 * Continua fora de questão, e não existe caminho para isso no código: disparo
 * em massa, campanha, lista de transmissão e mensagem automática.
 */
export async function iniciarConversa(
  _estado: EstadoIniciar,
  formData: FormData
): Promise<EstadoIniciar> {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const dados = iniciarSchema.safeParse({
    telefone: formData.get("telefone"),
    texto: formData.get("texto"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const chave = chaveTelefone(dados.data.telefone);
  if (!chave) return { erro: "Telefone não reconhecido. Use DDD + número." };

  const { data: existente } = await supabase
    .from("ConversaWhatsapp")
    .select("id")
    .eq("telefone", chave)
    .maybeSingle();

  // Conversa que já existe não conta contra o teto e não é recriada: o teto
  // protege contra abordar desconhecido, não contra responder quem já fala com
  // a empresa. Quem chegar aqui com número conhecido é mandado para a conversa.
  if (existente) {
    return {
      erro:
        "Já existe conversa com este número — abra-a na lista para continuar o atendimento.",
    };
  }

  const { data: parametros } = await supabase
    .from("ParametroGeral")
    .select("tetoDiarioConversasNovas")
    .limit(1)
    .maybeSingle();

  const teto = parametros?.tetoDiarioConversasNovas ?? 0;

  const { count } = await supabase
    .from("ConversaWhatsapp")
    .select("id", { count: "exact", head: true })
    .gte("iniciadaAtivamenteEm", inicioDoDiaBrasilia());

  if ((count ?? 0) >= teto) {
    return {
      erro:
        `Teto diário atingido: ${count} de ${teto} conversas iniciadas hoje. ` +
        "O limite existe porque abordar quem não escreveu é o que mais leva ao " +
        "bloqueio do número pela Meta. Continue amanhã ou ajuste o teto em Parâmetros.",
    };
  }

  const agora = new Date().toISOString();
  const dono = await donoDoTelefone(dados.data.telefone);

  const { data: conversa, error: erroConversa } = await supabase
    .from("ConversaWhatsapp")
    .insert({
      telefone: chave,
      telefoneExibicao: formatarTelefone(dados.data.telefone),
      clienteId: dono?.clienteId ?? null,
      contatoClienteId: dono?.contatoClienteId ?? null,
      donoId: usuarioId,
      iniciadaAtivamenteEm: agora,
      pendente: false,
    })
    .select("id, telefoneExibicao")
    .single();

  if (erroConversa || !conversa) return { erro: "Não foi possível criar a conversa." };

  // Mesma ordem do envio comum: grava antes de sair, porque o registro do que
  // foi dito ao cliente não pode depender de o número estar no ar.
  const { data: gravada } = await supabase
    .from("MensagemWhatsapp")
    .insert({
      conversaId: conversa.id,
      direcao: "saida",
      tipo: "texto",
      conteudo: dados.data.texto,
      enviadoPorId: usuarioId,
      entregue: false,
      recebidoEm: agora,
    })
    .select("id")
    .single();

  const envio = await enviarTexto(telefoneParaEnvio(conversa.telefoneExibicao), dados.data.texto);

  if (gravada) {
    await supabase
      .from("MensagemWhatsapp")
      .update({
        entregue: envio.ok,
        erroEnvio: envio.ok ? null : envio.erro,
        mensagemExternaId: envio.ok ? envio.idExterno : null,
      })
      .eq("id", gravada.id);
  }

  await supabase
    .from("ConversaWhatsapp")
    .update({
      ultimaMensagemEm: agora,
      ultimaMensagemDirecao: "saida",
      atualizadoEm: agora,
    })
    .eq("id", conversa.id);

  revalidar();

  if (!envio.ok) {
    return { erro: `Conversa criada e mensagem registrada, mas o envio falhou: ${envio.erro}` };
  }
}

// --- Envio de arquivo e de voz -------------------------------------------

export type EstadoArquivo = { erro?: string } | undefined;

/** Segundos de vida da URL assinada entregue ao gateway. Curta porque a URL é
 *  a única coisa que abre um bucket privado; longa o bastante para o gateway
 *  baixar o arquivo antes de expirar mesmo com fila. */
const VALIDADE_URL_GATEWAY = 300;

/**
 * Envia arquivo ou gravação de voz ao cliente.
 *
 * Mesma disciplina do envio de texto e pelo mesmo motivo: o arquivo sobe para o
 * Storage e a mensagem é gravada ANTES de a mídia sair pelo gateway. Se o
 * número cair no meio, a empresa perde a entrega, não o registro do que tentou
 * mandar — e o atendente vê a mensagem marcada como não entregue em vez de
 * ficar sem saber se foi.
 */
export async function enviarArquivo(
  conversaId: string,
  _estado: EstadoArquivo,
  formData: FormData
): Promise<EstadoArquivo> {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo." };
  }
  if (arquivo.size > TAMANHO_MAXIMO_ENVIO) {
    return { erro: "Arquivo maior que 10MB." };
  }

  const conversa = await carregarConversa(conversaId);
  if (!conversa) return { erro: "Conversa não encontrada." };

  const ehVoz = formData.get("voz") === "1";
  const legenda = String(formData.get("legenda") ?? "").trim() || null;
  const tipo = ehVoz ? ("audio" as const) : tipoPorMime(arquivo.type);
  const nome = ehVoz ? `voz-${Date.now()}.ogg` : arquivo.name;

  const caminho = `${conversaId}/${crypto.randomUUID()}-${nomeSeguro(nome)}`;
  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_MIDIA)
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });

  if (erroUpload) return { erro: "Falha ao subir o arquivo." };

  const agora = new Date().toISOString();

  const { data: gravada, error: erroGravacao } = await supabase
    .from("MensagemWhatsapp")
    .insert({
      conversaId,
      direcao: "saida",
      tipo,
      conteudo: legenda,
      enviadoPorId: usuarioId,
      chamadoId: chamadoCorrente(conversa, conversa.chamadoAtivo),
      caminhoStorage: caminho,
      nomeArquivo: nome,
      tamanho: arquivo.size,
      mime: arquivo.type || null,
      entregue: false,
      recebidoEm: agora,
    })
    .select("id")
    .single();

  // Sem o registro no banco o objeto vira lixo invisível no bucket.
  if (erroGravacao || !gravada) {
    await supabase.storage.from(BUCKET_MIDIA).remove([caminho]);
    return { erro: "Não foi possível registrar a mensagem." };
  }

  const { data: assinada } = await supabase.storage
    .from(BUCKET_MIDIA)
    .createSignedUrl(caminho, VALIDADE_URL_GATEWAY);

  let envio: { ok: boolean; idExterno?: string | null; erro?: string };
  if (!assinada?.signedUrl) {
    envio = { ok: false, erro: "Falha ao gerar o link temporário do arquivo." };
  } else {
    envio = await enviarMidia(
      telefoneParaEnvio(conversa.telefoneExibicao),
      tipoParaGateway(tipo, ehVoz),
      assinada.signedUrl,
      legenda,
      nome
    );
  }

  await supabase
    .from("MensagemWhatsapp")
    .update({
      entregue: envio.ok,
      erroEnvio: envio.ok ? null : (envio.erro ?? "Falha desconhecida no envio."),
      mensagemExternaId: envio.ok ? (envio.idExterno ?? null) : null,
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
    return { erro: `Arquivo registrado, mas o envio falhou: ${envio.erro}` };
  }
}
