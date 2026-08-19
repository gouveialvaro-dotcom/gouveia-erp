"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import { calcularTotais } from "@/lib/proposta";
import { custoDiarioFuncionario, DIAS_UTEIS_MES_PADRAO } from "@/lib/mao-obra";
import { ORDEM_ESTAGIO_FLUXO } from "@/lib/crm";

const orcamentoSchema = z.object({
  nomeProjeto: z.string().min(1, "Informe o nome do projeto."),
  clienteId: z.string().min(1, "Selecione o cliente."),
  tipoProposta: z.enum(["usina_solar", "redes"]),
  descricao: z.string().optional(),
  status: z.enum(["em_elaboracao", "finalizado", "revisao"]).optional(),
});

export type EstadoFormOrcamento = { erro?: string } | undefined;

export async function salvarOrcamento(
  orcamentoId: string | null,
  _estado: EstadoFormOrcamento,
  formData: FormData
): Promise<EstadoFormOrcamento> {
  const { usuarioId } = await exigirPermissao("orcamentos", "escrita");

  const dados = orcamentoSchema.safeParse({
    nomeProjeto: formData.get("nomeProjeto"),
    clienteId: formData.get("clienteId"),
    tipoProposta: formData.get("tipoProposta"),
    descricao: formData.get("descricao") || undefined,
    status: formData.get("status") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let id = orcamentoId;
  if (orcamentoId) {
    const { error } = await supabase.from("Orcamento").update(dados.data).eq("id", orcamentoId);
    if (error) return { erro: "Não foi possível salvar o orçamento." };
  } else {
    const { data: criado, error } = await supabase
      .from("Orcamento")
      .insert({ ...dados.data, criadoPorId: usuarioId })
      .select("id")
      .single();
    if (error || !criado) return { erro: "Não foi possível criar o orçamento." };
    id = criado.id;
  }

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${id}`);
}

export async function adicionarMaterialOrcamento(orcamentoId: string, formData: FormData) {
  await exigirPermissao("orcamentos", "escrita");

  const materialId = String(formData.get("materialId") ?? "");
  const quantidade = Number(formData.get("quantidade"));

  if (!materialId || !quantidade || quantidade <= 0) {
    throw new Error("Selecione um material e uma quantidade válida.");
  }

  const { data: material } = await supabase
    .from("Material")
    .select("custoUnitario")
    .eq("id", materialId)
    .single();

  if (!material) throw new Error("Material não encontrado.");

  const { data: itemExistente } = await supabase
    .from("OrcamentoItem")
    .select("*")
    .eq("orcamentoId", orcamentoId)
    .eq("materialId", materialId)
    .eq("tipo", "material")
    .maybeSingle();

  if (itemExistente) {
    const novaQuantidade = itemExistente.quantidade + quantidade;
    await supabase
      .from("OrcamentoItem")
      .update({
        quantidade: novaQuantidade,
        custoUnitarioNoMomento: material.custoUnitario,
        subtotal: novaQuantidade * material.custoUnitario,
      })
      .eq("id", itemExistente.id);
  } else {
    await supabase.from("OrcamentoItem").insert({
      orcamentoId,
      materialId,
      tipo: "material",
      quantidade,
      custoUnitarioNoMomento: material.custoUnitario,
      subtotal: quantidade * material.custoUnitario,
    });
  }

  revalidatePath(`/orcamentos/${orcamentoId}`);
}

export async function removerMaterialOrcamento(orcamentoId: string, itemId: string) {
  await exigirPermissao("orcamentos", "escrita");
  await supabase.from("OrcamentoItem").delete().eq("id", itemId);
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

// Aloca um funcionário ao orçamento. O custo é congelado no momento da alocação
// (como o custo unitário dos materiais), para que um reajuste salarial futuro
// não altere orçamentos já fechados.
export async function adicionarMaoObraOrcamento(orcamentoId: string, formData: FormData) {
  await exigirPermissao("orcamentos", "escrita");

  const funcionarioId = String(formData.get("funcionarioId") ?? "");
  const diasAlocados = Number(formData.get("diasAlocados"));

  if (!funcionarioId || !diasAlocados || diasAlocados <= 0) {
    throw new Error("Selecione um funcionário e uma quantidade de dias válida.");
  }

  const [{ data: funcionario }, { data: parametros }] = await Promise.all([
    supabase
      .from("Funcionario")
      .select("salarioMensal, encargosPercent")
      .eq("id", funcionarioId)
      .maybeSingle(),
    supabase.from("ParametroGeral").select("diasUteisMes").limit(1).maybeSingle(),
  ]);

  if (!funcionario) throw new Error("Funcionário não encontrado.");

  const custoDia = custoDiarioFuncionario(
    funcionario,
    parametros?.diasUteisMes ?? DIAS_UTEIS_MES_PADRAO
  );

  const { data: alocacaoExistente } = await supabase
    .from("OrcamentoMaoObra")
    .select("*")
    .eq("orcamentoId", orcamentoId)
    .eq("funcionarioId", funcionarioId)
    .maybeSingle();

  if (alocacaoExistente) {
    const dias = alocacaoExistente.diasAlocados + diasAlocados;
    await supabase
      .from("OrcamentoMaoObra")
      .update({ diasAlocados: dias, custoCalculado: custoDia * dias })
      .eq("id", alocacaoExistente.id);
  } else {
    await supabase.from("OrcamentoMaoObra").insert({
      orcamentoId,
      funcionarioId,
      diasAlocados,
      custoCalculado: custoDia * diasAlocados,
    });
  }

  revalidatePath(`/orcamentos/${orcamentoId}`);
}

export async function removerMaoObraOrcamento(orcamentoId: string, alocacaoId: string) {
  await exigirPermissao("orcamentos", "escrita");
  await supabase.from("OrcamentoMaoObra").delete().eq("id", alocacaoId);
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

const ajustesComerciaisSchema = z.object({
  // String vazia devolve o BDI ao padrão dos parâmetros gerais.
  bdi: z
    .union([z.literal(""), z.coerce.number().min(0).max(500)])
    .transform((v) => (v === "" ? null : v)),
  ajusteMaoObraPercent: z.coerce.number().min(-100).max(500),
  descontoPercent: z.coerce.number().min(0).max(100),
});

export type EstadoAjustes = { erro?: string; sucesso?: boolean } | undefined;

export async function salvarAjustesComerciais(
  orcamentoId: string,
  _estado: EstadoAjustes,
  formData: FormData
): Promise<EstadoAjustes> {
  await exigirPermissao("orcamentos", "escrita");

  const dados = ajustesComerciaisSchema.safeParse({
    bdi: formData.get("bdi") ?? "",
    ajusteMaoObraPercent: formData.get("ajusteMaoObraPercent") || 0,
    descontoPercent: formData.get("descontoPercent") || 0,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Valores inválidos." };
  }

  const { error } = await supabase
    .from("Orcamento")
    .update({
      bdiPersonalizado: dados.data.bdi,
      ajusteMaoObraPercent: dados.data.ajusteMaoObraPercent,
      descontoPercent: dados.data.descontoPercent,
    })
    .eq("id", orcamentoId);

  if (error) return { erro: `Não foi possível salvar os ajustes: ${error.message}` };

  revalidatePath(`/orcamentos/${orcamentoId}`);
  return { sucesso: true };
}

// Aplica um desconto sugerido direto pela tabela de simulação, preservando os
// demais ajustes já gravados.
export async function aplicarDesconto(orcamentoId: string, percentual: number) {
  await exigirPermissao("orcamentos", "escrita");
  await supabase.from("Orcamento").update({ descontoPercent: percentual }).eq("id", orcamentoId);
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

const gerarPropostaSchema = z.object({
  modelo: z.enum(["usina_solar", "redes"]),
  formato: z.enum(["pdf", "word"]),
});

export type EstadoGerarProposta = { erro?: string; url?: string } | undefined;

// Emite uma nova proposta a partir do orçamento e joga o resultado no funil de
// vendas. O arquivo em si não é armazenado: `arquivoUrl` aponta para a rota que
// renderiza o documento sob demanda, sempre a partir dos dados do orçamento.
export async function gerarProposta(
  orcamentoId: string,
  _estado: EstadoGerarProposta,
  formData: FormData
): Promise<EstadoGerarProposta> {
  const { usuarioId } = await exigirPermissao("orcamentos", "escrita");

  const dados = gerarPropostaSchema.safeParse({
    modelo: formData.get("modelo"),
    formato: formData.get("formato"),
  });

  if (!dados.success) {
    return { erro: "Selecione o modelo e o formato da proposta." };
  }

  const [{ data: orcamento }, { data: parametros }] = await Promise.all([
    supabase
      .from("Orcamento")
      .select("*, itens:OrcamentoItem(subtotal, tipo), maoObra:OrcamentoMaoObra(custoCalculado)")
      .eq("id", orcamentoId)
      .eq("itens.tipo", "material")
      .maybeSingle(),
    supabase.from("ParametroGeral").select("*").limit(1).maybeSingle(),
  ]);

  if (!orcamento) return { erro: "Orçamento não encontrado." };
  if (orcamento.itens.length === 0 && orcamento.maoObra.length === 0) {
    return { erro: "Lance ao menos um material ou mão de obra antes de gerar a proposta." };
  }

  const totais = calcularTotais({
    custoMateriais: orcamento.itens.reduce((acc, item) => acc + item.subtotal, 0),
    custoMaoObra: orcamento.maoObra.reduce((acc, m) => acc + m.custoCalculado, 0),
    percentualBdi: orcamento.bdiPersonalizado ?? parametros?.bdiPadrao ?? 0,
    percentualImpostos: orcamento.impostosPersonalizado ?? parametros?.impostos ?? 0,
    percentualAjusteMaoObra: orcamento.ajusteMaoObraPercent,
    percentualDesconto: orcamento.descontoPercent,
  });

  const ano = new Date().getFullYear();

  // Reemitir a proposta de um orçamento é uma REVISÃO: mantém o número original
  // e avança a revisão (001/2026 Rev. 01, Rev. 02...). Cada revisão é uma linha
  // nova — nenhuma emissão anterior é sobrescrita ou apagada.
  const { data: anterior } = await supabase
    .from("Proposta")
    .select("numero, ano, revisao")
    .eq("orcamentoId", orcamentoId)
    .order("revisao", { ascending: false })
    .limit(1)
    .maybeSingle();

  let numero: number;
  let anoProposta: number;
  let revisao: number;

  if (anterior) {
    numero = anterior.numero;
    anoProposta = anterior.ano;
    revisao = anterior.revisao + 1;
  } else {
    const { data: ultimaDoAno } = await supabase
      .from("Proposta")
      .select("numero")
      .eq("ano", ano)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();

    numero = (ultimaDoAno?.numero ?? 0) + 1;
    anoProposta = ano;
    revisao = 0;
  }

  // Duas emissões simultâneas podem escolher o mesmo par e a constraint barra a
  // segunda. O contador é avançado localmente a cada tentativa, em vez de reler
  // o máximo: uma leitura desatualizada devolveria o mesmo valor e o laço
  // colidiria até esgotar as tentativas.
  let proposta: { id: string } | null = null;
  let ultimoErro: { code?: string; message?: string } | null = null;

  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const { data, error } = await supabase
      .from("Proposta")
      .insert({
        orcamentoId,
        modeloUsado: dados.data.modelo,
        valorFinal: totais.valorFinal,
        numero,
        ano: anoProposta,
        revisao,
        geradoPorId: usuarioId,
        arquivoUrl: "",
      })
      .select("id")
      .single();

    if (data) {
      proposta = data;
      break;
    }

    ultimoErro = error;
    // 23505 = unique_violation; qualquer outro erro não se resolve repetindo.
    if (error?.code !== "23505") break;
    if (anterior) revisao++;
    else numero++;
  }

  if (!proposta) {
    console.error("Falha ao gerar proposta:", ultimoErro);
    return {
      erro: ultimoErro?.message
        ? `Não foi possível gerar a proposta: ${ultimoErro.message}`
        : "Não foi possível gerar a proposta.",
    };
  }

  const url =
    dados.data.formato === "word"
      ? `/api/propostas/${proposta.id}/word`
      : `/propostas/${proposta.id}`;

  await supabase.from("Proposta").update({ arquivoUrl: url }).eq("id", proposta.id);

  // Funil de vendas: a emissão da proposta cria a oportunidade quando ela ainda
  // não existe, ou puxa a existente até "proposta_enviada".
  const { data: oportunidade } = await supabase
    .from("Oportunidade")
    .select("id, estagio")
    .eq("orcamentoId", orcamentoId)
    .maybeSingle();

  if (oportunidade) {
    const indiceAtual = ORDEM_ESTAGIO_FLUXO.indexOf(
      oportunidade.estagio as (typeof ORDEM_ESTAGIO_FLUXO)[number]
    );
    const indiceProposta = ORDEM_ESTAGIO_FLUXO.indexOf("proposta_enviada");
    // Nunca puxa para trás uma oportunidade já em negociação ou aprovada.
    const avanca = indiceAtual >= 0 && indiceAtual < indiceProposta;

    await supabase
      .from("Oportunidade")
      .update({
        valorEstimado: totais.valorFinal,
        ...(avanca ? { estagio: "proposta_enviada" as const } : {}),
      })
      .eq("id", oportunidade.id);
  } else {
    await supabase.from("Oportunidade").insert({
      orcamentoId,
      clienteId: orcamento.clienteId,
      responsavelId: usuarioId,
      valorEstimado: totais.valorFinal,
      estagio: "proposta_enviada",
    });
  }

  revalidatePath("/crm");
  revalidatePath(`/orcamentos/${orcamentoId}`);

  return { url };
}
