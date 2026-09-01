"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import {
  BUCKET_ANEXOS,
  ORDEM_ESTAGIO_FLUXO,
  PERFIS_RESPONSAVEL_CHAMADO,
  ROTULO_ESTAGIO,
  TAMANHO_MAXIMO_ANEXO,
  hojeIso,
  nomeSeguro,
  podeSerResponsavel,
  podeTrocarResponsavel,
  somarDias,
} from "@/lib/pos-venda";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import { impedimentoDeAbertura } from "@/lib/clientes";
import { notificarPosVenda } from "@/lib/notificacoes-pos-venda";

export type EstadoFormChamado = { erro?: string } | undefined;

// A troca de responsável não redireciona — a pessoa continua na mesma tela, com
// o diálogo aberto. O `ok` é o que diz ao diálogo que ele pode se fechar; sem
// ele, sucesso e estado inicial seriam ambos `undefined` e indistinguíveis.
export type EstadoTrocaResponsavel = { erro?: string; ok?: boolean } | undefined;

function revalidarChamado(chamadoId: string) {
  revalidatePath("/pos-venda");
  revalidatePath(`/pos-venda/${chamadoId}`);
}

// Cabeçalho legível do chamado para o texto da notificação — sem isso o aviso
// chegaria como um id opaco.
async function resumoChamado(chamadoId: string) {
  const { data } = await supabase
    .from("Chamado")
    .select("numero, titulo, cliente:Cliente(razaoSocial)")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!data) return null;
  return {
    numero: data.numero,
    titulo: data.titulo,
    cliente: data.cliente?.razaoSocial ?? "—",
  };
}

// Concluir o chamado devolve a conversa de WhatsApp para "sem chamado". A
// marcação é corrente, não histórica: a próxima mensagem do cliente já costuma
// ser outro assunto e não pode entrar num atendimento encerrado. As mensagens
// que já estavam vinculadas não são tocadas (ver lib/pos-venda-whatsapp.ts).
async function soltarConversasDoChamado(chamadoId: string) {
  const { data } = await supabase
    .from("ConversaWhatsapp")
    .update({ chamadoAtivoId: null, atualizadoEm: new Date().toISOString() })
    .eq("chamadoAtivoId", chamadoId)
    .select("id");

  if (data?.length) revalidatePath("/pos-venda/whatsapp");
}

// A tela só oferece quem é elegível, mas a action é alcançável por POST direto:
// aqui é a trava de fato. A regra em si mora em lib/pos-venda.ts, porque é a
// MESMA que monta o combobox — duas cópias divergiriam no primeiro ajuste.
// Devolve o nome, que os avisos e a nota do histórico precisam de qualquer jeito.
async function responsavelElegivel(usuarioId: string) {
  const { data } = await supabase
    .from("Usuario")
    .select("id, nome, perfil, ativo")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!data || !podeSerResponsavel({ ativo: data.ativo, perfil: data.perfil as Perfil })) {
    return null;
  }
  return { id: data.id, nome: data.nome };
}

const ERRO_ELEGIVEL = `O responsável precisa ser um usuário ativo com perfil ${PERFIS_RESPONSAVEL_CHAMADO.map(
  (perfil) => ROTULO_PERFIL[perfil]
).join(" ou ")}.`;

// O prazo do SLA nasce do tipo de problema, não da digitação: cada tipo tem
// prazoDias cadastrado (ver /cadastros/tipos-problema) e o limite é a data de
// abertura + esse prazo, em dias corridos.
async function prazoDoTipo(tipoProblemaId: string, abertoEm: string) {
  const { data: tipo } = await supabase
    .from("TipoProblemaPosVenda")
    .select("prazoDias")
    .eq("id", tipoProblemaId)
    .maybeSingle();
  if (!tipo) return null;
  return somarDias(abertoEm, tipo.prazoDias);
}

const criarChamadoSchema = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  tipoProblemaId: z.string().min(1, "Selecione o tipo de problema."),
  titulo: z.string().min(1, "Informe um título para o chamado."),
  descricao: z.string().optional(),
  unidadeConsumidoraId: z.string().optional(),
  obraId: z.string().optional(),
  responsavelId: z.string().min(1, "Selecione o responsável."),
  prioridade: z.enum(["baixa", "media", "alta", "critica"]),
  abertoEm: z.string().min(1, "Informe a data de abertura."),
  protocoloConcessionaria: z.string().optional(),
});

export async function criarChamado(
  _estado: EstadoFormChamado,
  formData: FormData
): Promise<EstadoFormChamado> {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const dados = criarChamadoSchema.safeParse({
    clienteId: formData.get("clienteId"),
    tipoProblemaId: formData.get("tipoProblemaId"),
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    unidadeConsumidoraId: formData.get("unidadeConsumidoraId") || undefined,
    obraId: formData.get("obraId") || undefined,
    responsavelId: formData.get("responsavelId"),
    prioridade: formData.get("prioridade") || "media",
    abertoEm: formData.get("abertoEm") || hojeIso(),
    protocoloConcessionaria: formData.get("protocoloConcessionaria") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Quem autoriza o atendimento é o cadastro do cliente: o pós-venda só atende
  // energia solar e só dentro da vigência do contrato de manutenção. A tela já
  // avisa antes de enviar; aqui é a trava de fato (a action é alcançável por
  // POST direto).
  const { data: cliente } = await supabase
    .from("Cliente")
    .select("ramo, manutencaoInicio, manutencaoFim")
    .eq("id", dados.data.clienteId)
    .maybeSingle();

  if (!cliente) return { erro: "Cliente não encontrado." };

  const impedimento = impedimentoDeAbertura(cliente, dados.data.abertoEm);
  if (impedimento) return { erro: impedimento };

  const responsavel = await responsavelElegivel(dados.data.responsavelId);
  if (!responsavel) return { erro: ERRO_ELEGIVEL };

  const prazoLimite = await prazoDoTipo(dados.data.tipoProblemaId, dados.data.abertoEm);
  if (!prazoLimite) return { erro: "Tipo de problema não encontrado." };

  const { data: criado, error } = await supabase
    .from("Chamado")
    .insert({
      clienteId: dados.data.clienteId,
      tipoProblemaId: dados.data.tipoProblemaId,
      titulo: dados.data.titulo,
      descricao: dados.data.descricao ?? null,
      unidadeConsumidoraId: dados.data.unidadeConsumidoraId ?? null,
      obraId: dados.data.obraId ?? null,
      responsavelId: dados.data.responsavelId,
      prioridade: dados.data.prioridade,
      abertoEm: dados.data.abertoEm,
      prazoLimite,
      protocoloConcessionaria: dados.data.protocoloConcessionaria ?? null,
      criadoPorId: usuarioId,
    })
    .select("id")
    .single();

  if (error || !criado) return { erro: "Não foi possível abrir o chamado." };

  // Abertura não é mais notícia para uma lista: é uma atribuição a UMA pessoa,
  // que fica sabendo que o chamado é dela. Por isso "chamado_direcionado" no
  // lugar de "chamado_novo" e alcance restrito ao dono — os admins não são
  // avisados de cada abertura, só do que sai do trilho depois.
  const resumo = await resumoChamado(criado.id);
  await notificarPosVenda({
    chamadoId: criado.id,
    tipo: "chamado_direcionado",
    titulo: `Chamado #${resumo?.numero} é seu`,
    detalhe: `${resumo?.cliente} · ${dados.data.titulo}`,
    referencia: criado.id,
    alcance: "somente_dono",
    autorId: usuarioId,
  });

  revalidatePath("/pos-venda");
  redirect(`/pos-venda/${criado.id}`);
}

// O responsável NÃO entra aqui de propósito: trocar de dono tem autorização
// própria (dono atual ou admin), não vale para chamado concluído e precisa
// virar registro no histórico. Tudo isso mora em trocarResponsavel(); aceitar
// o campo também neste formulário abriria um segundo caminho sem nenhuma
// dessas travas.
const atualizarChamadoSchema = z.object({
  estagio: z.enum(["aberto", "em_analise", "aguardando_concessionaria", "concluido"]),
  tipoProblemaId: z.string().min(1, "Selecione o tipo de problema."),
  prioridade: z.enum(["baixa", "media", "alta", "critica"]),
  unidadeConsumidoraId: z.string().optional(),
  obraId: z.string().optional(),
  prazoLimite: z.string().min(1, "Informe o prazo."),
  protocoloConcessionaria: z.string().optional(),
  solucao: z.string().optional(),
});

export async function atualizarChamado(
  chamadoId: string,
  _estado: EstadoFormChamado,
  formData: FormData
): Promise<EstadoFormChamado> {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const dados = atualizarChamadoSchema.safeParse({
    estagio: formData.get("estagio"),
    tipoProblemaId: formData.get("tipoProblemaId"),
    prioridade: formData.get("prioridade"),
    unidadeConsumidoraId: formData.get("unidadeConsumidoraId") || undefined,
    obraId: formData.get("obraId") || undefined,
    prazoLimite: formData.get("prazoLimite"),
    protocoloConcessionaria: formData.get("protocoloConcessionaria") || undefined,
    solucao: formData.get("solucao") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const concluido = dados.data.estagio === "concluido";
  if (concluido && !dados.data.solucao) {
    return { erro: "Descreva a solução antes de concluir o chamado." };
  }

  const { data: atual } = await supabase
    .from("Chamado")
    .select("estagio, concluidoEm")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!atual) return { erro: "Chamado não encontrado." };

  const { error } = await supabase
    .from("Chamado")
    .update({
      estagio: dados.data.estagio,
      tipoProblemaId: dados.data.tipoProblemaId,
      prioridade: dados.data.prioridade,
      unidadeConsumidoraId: dados.data.unidadeConsumidoraId ?? null,
      obraId: dados.data.obraId ?? null,
      prazoLimite: dados.data.prazoLimite,
      protocoloConcessionaria: dados.data.protocoloConcessionaria ?? null,
      solucao: dados.data.solucao ?? null,
      // concluidoEm alimenta o indicador de tempo médio de resolução, então
      // preserva a data original numa reedição e some ao reabrir.
      concluidoEm: concluido ? (atual.concluidoEm ?? hojeIso()) : null,
      atualizadoEm: new Date().toISOString(),
    })
    .eq("id", chamadoId);

  if (error) return { erro: "Não foi possível salvar o chamado." };

  if (concluido) await soltarConversasDoChamado(chamadoId);

  const resumo = await resumoChamado(chamadoId);
  const mudouEstagio = atual.estagio !== dados.data.estagio;
  await notificarPosVenda({
    chamadoId,
    tipo: "chamado_atualizado",
    titulo: `Chamado #${resumo?.numero} atualizado`,
    detalhe: mudouEstagio
      ? `${resumo?.cliente} · ${ROTULO_ESTAGIO[atual.estagio]} → ${ROTULO_ESTAGIO[dados.data.estagio]}`
      : `${resumo?.cliente} · ${resumo?.titulo}`,
    referencia: new Date().toISOString(),
    autorId: usuarioId,
  });

  revalidarChamado(chamadoId);
  redirect(`/pos-venda/${chamadoId}`);
}

/**
 * Repasse do chamado. Não existe "devolver para a fila": o chamado nunca fica
 * sem dono, então a troca é sempre de uma pessoa elegível para outra.
 */
export async function trocarResponsavel(
  chamadoId: string,
  _estado: EstadoTrocaResponsavel,
  formData: FormData
): Promise<EstadoTrocaResponsavel> {
  const { perfil, usuarioId } = await exigirPermissao("posVenda", "escrita");

  const novoId = String(formData.get("responsavelId") ?? "");
  if (!novoId) return { erro: "Selecione o novo responsável." };

  const { data: chamado } = await supabase
    .from("Chamado")
    .select("id, numero, estagio, responsavelId, responsavel:Usuario!Chamado_responsavelId_fkey(nome)")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!chamado) return { erro: "Chamado não encontrado." };

  // Esconder o botão não substitui o bloqueio: perfil atendimento que não é o
  // dono chega aqui por POST direto se quiser.
  const autorizado = podeTrocarResponsavel({
    perfil: perfil as Perfil,
    usuarioId,
    responsavelId: chamado.responsavelId,
    estagio: chamado.estagio,
  });

  if (!autorizado) {
    return {
      erro:
        chamado.estagio === "concluido"
          ? "Chamado concluído não troca de responsável."
          : "Só o responsável atual ou um administrador pode repassar este chamado.",
    };
  }

  if (novoId === chamado.responsavelId) {
    return { erro: "Este já é o responsável do chamado." };
  }

  const novo = await responsavelElegivel(novoId);
  if (!novo) return { erro: ERRO_ELEGIVEL };

  const anteriorId = chamado.responsavelId;
  const anteriorNome = chamado.responsavel?.nome ?? "—";

  const { error } = await supabase
    .from("Chamado")
    .update({ responsavelId: novo.id, atualizadoEm: new Date().toISOString() })
    .eq("id", chamadoId);

  if (error) return { erro: "Não foi possível trocar o responsável." };

  // O repasse vira uma linha da própria linha do tempo, e não uma tabela de
  // histórico à parte: quem lê o chamado precisa ver a troca na mesma sequência
  // das ligações e dos protocolos, senão a passagem de bastão fica invisível.
  await supabase.from("InteracaoChamado").insert({
    chamadoId,
    tipo: "nota_interna",
    direcao: "interno",
    data: hojeIso(),
    descricao: `Responsável alterado de ${anteriorNome} para ${novo.nome}.`,
    responsavelId: usuarioId,
  });

  const resumo = await resumoChamado(chamadoId);
  await notificarPosVenda({
    chamadoId,
    tipo: "responsavel_alterado",
    titulo: `Chamado #${resumo?.numero} passou para ${novo.nome}`,
    detalhe: `${resumo?.cliente} · de ${anteriorNome} para ${novo.nome}`,
    // A referência é o id do NOVO dono, não o do chamado: trocas sucessivas são
    // eventos distintos e cada uma precisa gerar o seu aviso.
    referencia: novo.id,
    // O dono anterior sai da regra assim que a coluna é gravada — sem entrar
    // como extra, ele não saberia que largou o chamado.
    extras: [anteriorId],
    autorId: usuarioId,
  });

  revalidarChamado(chamadoId);
  return { ok: true };
}

async function moverEstagio(chamadoId: string, estagioAtual: string, passo: 1 | -1) {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const indice = ORDEM_ESTAGIO_FLUXO.indexOf(
    estagioAtual as (typeof ORDEM_ESTAGIO_FLUXO)[number]
  );
  const destino = indice + passo;
  if (indice < 0 || destino < 0 || destino > ORDEM_ESTAGIO_FLUXO.length - 1) return;

  const estagio = ORDEM_ESTAGIO_FLUXO[destino];
  await supabase
    .from("Chamado")
    .update({
      estagio,
      concluidoEm: estagio === "concluido" ? hojeIso() : null,
      atualizadoEm: new Date().toISOString(),
    })
    .eq("id", chamadoId);

  if (estagio === "concluido") await soltarConversasDoChamado(chamadoId);

  const resumo = await resumoChamado(chamadoId);
  await notificarPosVenda({
    chamadoId,
    tipo: "chamado_atualizado",
    titulo: `Chamado #${resumo?.numero} movido para ${ROTULO_ESTAGIO[estagio]}`,
    detalhe: `${resumo?.cliente} · ${resumo?.titulo}`,
    referencia: new Date().toISOString(),
    autorId: usuarioId,
  });

  revalidarChamado(chamadoId);
}

export async function avancarEstagio(chamadoId: string, estagioAtual: string) {
  await moverEstagio(chamadoId, estagioAtual, 1);
}

export async function voltarEstagio(chamadoId: string, estagioAtual: string) {
  await moverEstagio(chamadoId, estagioAtual, -1);
}

const interacaoSchema = z.object({
  tipo: z.enum([
    "ligacao",
    "email",
    "whatsapp",
    "reuniao",
    "visita",
    "agencia_cosern",
    "protocolo",
    "nota_interna",
  ]),
  direcao: z.enum(["cliente", "concessionaria", "interno"]),
  data: z.string().min(1, "Informe a data."),
  descricao: z.string().min(1, "Descreva a interação."),
  protocolo: z.string().optional(),
});

export async function adicionarInteracao(chamadoId: string, formData: FormData) {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const dados = interacaoSchema.safeParse({
    tipo: formData.get("tipo"),
    direcao: formData.get("direcao"),
    data: formData.get("data"),
    descricao: formData.get("descricao"),
    protocolo: formData.get("protocolo") || undefined,
  });
  if (!dados.success) return;

  const { data: interacao } = await supabase
    .from("InteracaoChamado")
    .insert({
      chamadoId,
      tipo: dados.data.tipo,
      direcao: dados.data.direcao,
      data: dados.data.data,
      descricao: dados.data.descricao,
      protocolo: dados.data.protocolo ?? null,
      responsavelId: usuarioId,
    })
    .select("id")
    .single();

  // Um protocolo registrado na linha do tempo é o número que o time cobra da
  // distribuidora depois; sobe para o chamado para aparecer no cabeçalho.
  if (dados.data.protocolo) {
    await supabase
      .from("Chamado")
      .update({ protocoloConcessionaria: dados.data.protocolo })
      .eq("id", chamadoId);
  }

  const resumo = await resumoChamado(chamadoId);
  await notificarPosVenda({
    chamadoId,
    tipo: "interacao_registrada",
    titulo: `Chamado #${resumo?.numero} recebeu uma interação`,
    detalhe: `${resumo?.cliente} · ${dados.data.descricao}`,
    referencia: interacao?.id ?? new Date().toISOString(),
    autorId: usuarioId,
  });

  revalidarChamado(chamadoId);
}

export async function removerInteracao(chamadoId: string, interacaoId: string) {
  await exigirPermissao("posVenda", "escrita");
  await supabase.from("InteracaoChamado").delete().eq("id", interacaoId);
  revalidarChamado(chamadoId);
}

export type EstadoAnexo = { erro?: string } | undefined;

export async function enviarAnexo(
  chamadoId: string,
  _estado: EstadoAnexo,
  formData: FormData
): Promise<EstadoAnexo> {
  const { usuarioId } = await exigirPermissao("posVenda", "escrita");

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo." };
  }
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
    return { erro: "Arquivo maior que 10MB." };
  }

  const caminho = `${chamadoId}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });

  if (erroUpload) return { erro: "Falha ao enviar o arquivo." };

  const { error } = await supabase.from("AnexoChamado").insert({
    chamadoId,
    nomeArquivo: arquivo.name,
    caminho,
    tipoMime: arquivo.type || null,
    tamanho: arquivo.size,
    enviadoPorId: usuarioId,
  });

  // Sem o registro no banco o objeto vira lixo invisível no bucket.
  if (error) {
    await supabase.storage.from(BUCKET_ANEXOS).remove([caminho]);
    return { erro: "Falha ao registrar o anexo." };
  }

  revalidarChamado(chamadoId);
}

export async function removerAnexo(chamadoId: string, anexoId: string) {
  await exigirPermissao("posVenda", "escrita");

  const { data: anexo } = await supabase
    .from("AnexoChamado")
    .select("caminho")
    .eq("id", anexoId)
    .maybeSingle();

  await supabase.from("AnexoChamado").delete().eq("id", anexoId);
  if (anexo) await supabase.storage.from(BUCKET_ANEXOS).remove([anexo.caminho]);

  revalidarChamado(chamadoId);
}

/** Formato que o BotaoExcluir espera de volta (ver components/ui/botao-excluir). */
export type EstadoExclusao = { erro?: string } | undefined;

// Apaga o chamado e tudo que pendura nele. Interações, anexos e notificações
// somem por CASCADE no banco, mas os arquivos no bucket não: sem removê-los
// aqui, viram lixo invisível no Storage, sem nenhuma linha que os referencie.
export async function excluirChamado(
  _estado: EstadoExclusao,
  formData: FormData
): Promise<EstadoExclusao> {
  await exigirPermissao("posVenda", "escrita");

  const chamadoId = String(formData.get("chamadoId") ?? "");

  const { data: chamado } = await supabase
    .from("Chamado")
    .select("id")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!chamado) return { erro: "Chamado não encontrado." };

  const { data: anexos } = await supabase
    .from("AnexoChamado")
    .select("caminho")
    .eq("chamadoId", chamadoId);

  const { error } = await supabase.from("Chamado").delete().eq("id", chamadoId);
  if (error) return { erro: "Não foi possível excluir o chamado." };

  const caminhos = (anexos ?? []).map((a) => a.caminho);
  if (caminhos.length > 0) {
    await supabase.storage.from(BUCKET_ANEXOS).remove(caminhos);
  }

  revalidatePath("/pos-venda");
  redirect("/pos-venda");
}
