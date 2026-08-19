"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import { ORDEM_ESTAGIO_FLUXO, ROTULO_ESTAGIO, hojeIso, somarDias } from "@/lib/pos-venda";
import { notificarPosVenda } from "@/lib/notificacoes-pos-venda";

export type EstadoFormChamado = { erro?: string } | undefined;

const BUCKET_ANEXOS = "pos-venda";
const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;

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

  const resumo = await resumoChamado(criado.id);
  await notificarPosVenda({
    chamadoId: criado.id,
    tipo: "chamado_novo",
    titulo: `Chamado #${resumo?.numero} aberto`,
    detalhe: `${resumo?.cliente} · ${dados.data.titulo}`,
    referencia: criado.id,
    autorId: usuarioId,
  });

  revalidatePath("/pos-venda");
  redirect(`/pos-venda/${criado.id}`);
}

const atualizarChamadoSchema = z.object({
  estagio: z.enum(["aberto", "em_analise", "aguardando_concessionaria", "concluido"]),
  tipoProblemaId: z.string().min(1, "Selecione o tipo de problema."),
  responsavelId: z.string().min(1, "Selecione o responsável."),
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
    responsavelId: formData.get("responsavelId"),
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
      responsavelId: dados.data.responsavelId,
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

// Sanitiza para o nome do objeto no bucket; o nome original vai para a coluna
// nomeArquivo e é o que o usuário vê.
function nomeSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-80);
}

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
