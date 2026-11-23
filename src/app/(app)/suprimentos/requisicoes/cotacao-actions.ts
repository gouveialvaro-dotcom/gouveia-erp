"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { buscarProdutos, type ProdutoEncontrado } from "@/lib/suprimentos-catalogo";
import {
  FORMAS_PAGAMENTO,
  STATUS_COTACAO_ABERTA,
  chaveDescricao,
  textoCondicaoPagamento,
} from "@/lib/suprimentos";
import { nomeSeguro } from "@/lib/pos-venda";

const BUCKET = "suprimentos";
const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;
import { numeroBr } from "@/lib/suprimentos-cotacao";

// Trabalho do comprador sobre uma requisição: vincular itens ao catálogo,
// lançar cotações e escolher quem fornece cada item. Tudo só enquanto a
// cotação está aberta (pendente ou em cotação).

type Resultado = { erro?: string } | undefined;

/**
 * Confere que a requisição aceita mexer na cotação e, na primeira mexida, tira
 * ela da fila: vira "em cotação" com o comprador que pegou. A partir daí o
 * requisitante não cancela mais sozinho.
 */
async function abrirCotacao(requisicaoId: string, usuarioId: string) {
  const { data: r } = await supabase
    .from("Requisicao")
    .select("id, status, compradorId")
    .eq("id", requisicaoId)
    .maybeSingle();
  if (!r) return { erro: "Requisição não encontrada." } as const;
  if (!STATUS_COTACAO_ABERTA.includes(r.status)) {
    return { erro: "A cotação desta requisição não está mais aberta." } as const;
  }

  if (r.status === "pendente" || !r.compradorId) {
    const { data: alterada, error } = await supabase
      .from("Requisicao")
      .update({
        status: "em_cotacao",
        compradorId: r.compradorId ?? usuarioId,
        atualizadoEm: new Date().toISOString(),
      })
      .eq("id", r.id)
      // Fecha a corrida com o cancelamento do requisitante.
      .in("status", STATUS_COTACAO_ABERTA)
      .select("id");
    if (error) return { erro: error.message } as const;
    if (!alterada?.length) return { erro: "A requisição mudou de situação. Recarregue a página." } as const;
  }
  return { ok: true } as const;
}

function revalidar(requisicaoId: string) {
  revalidatePath(`/suprimentos/requisicoes/${requisicaoId}`, "layout");
  revalidatePath("/suprimentos", "layout");
}

async function itemDaRequisicao(itemId: string) {
  const { data } = await supabase
    .from("RequisicaoItem")
    .select("id, requisicaoId, descricao, unidade")
    .eq("id", itemId)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------- catálogo

export type { ProdutoEncontrado } from "@/lib/suprimentos-catalogo";

export async function buscarProdutosCatalogo(q: string): Promise<ProdutoEncontrado[]> {
  await exigirPapelSuprimentos("comprador");
  return buscarProdutos(q);
}

export async function vincularProduto(itemId: string, produtoId: string | null): Promise<Resultado> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");
    const item = await itemDaRequisicao(itemId);
    if (!item) return { erro: "Item não encontrado." };
    const aberta = await abrirCotacao(item.requisicaoId, usuarioId);
    if ("erro" in aberta) return { erro: aberta.erro };

    const { error } = await supabase.from("RequisicaoItem").update({ produtoId }).eq("id", item.id);
    if (error) return { erro: error.message };
    revalidar(item.requisicaoId);
    return undefined;
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

/**
 * Cria no catálogo um produto com a descrição do item e já vincula. Se a
 * descrição já existe (mesma chave), vincula ao existente em vez de duplicar.
 * Nasce marcado "revisar" para o comprador completar categoria e tipo depois.
 */
export async function criarProdutoDoItem(itemId: string): Promise<Resultado> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");
    const item = await itemDaRequisicao(itemId);
    if (!item) return { erro: "Item não encontrado." };
    const aberta = await abrirCotacao(item.requisicaoId, usuarioId);
    if ("erro" in aberta) return { erro: aberta.erro };

    const chave = chaveDescricao(item.descricao);
    let { data: produto } = await supabase
      .from("Produto")
      .select("id")
      .eq("chaveDescricao", chave)
      .maybeSingle();

    if (!produto) {
      const { data: novo, error } = await supabase
        .from("Produto")
        .insert({
          descricao: item.descricao.replace(/\s+/g, " ").trim(),
          chaveDescricao: chave,
          unidade: item.unidade,
          tipo: "material",
          revisar: true,
          criadoPorId: usuarioId,
        })
        .select("id")
        .single();
      if (error) return { erro: error.message };
      produto = novo;
    }

    const { error } = await supabase
      .from("RequisicaoItem")
      .update({ produtoId: produto.id })
      .eq("id", item.id);
    if (error) return { erro: error.message };
    revalidar(item.requisicaoId);
    revalidatePath("/suprimentos/produtos");
    return undefined;
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

// ---------------------------------------------------------------- cotação

export type EstadoFormCotacao = { erro?: string } | undefined;

const dinheiro = (rotulo: string) =>
  z
    .number({ error: `${rotulo} inválido.` })
    .refine((v) => Number.isFinite(v), `${rotulo} inválido.`)
    .min(0, `${rotulo} não pode ser negativo.`);

const cotacaoSchema = z.object({
  requisicaoId: z.string().min(1),
  fornecedorId: z.string().min(1, "Selecione o fornecedor."),
  vendedor: z.string().trim().max(120).optional(),
  incideDifal: z.boolean(),
  aliquotaDifal: z.number().min(0).max(100, "Alíquota de DIFAL acima de 100%.").nullable(),
  valorDifal: dinheiro("Valor do DIFAL"),
  frete: z.enum(["cif", "fob"]),
  coletaPropria: z.boolean(),
  valorFrete: dinheiro("Valor do frete"),
  // "empresa:<id>" ou "cliente".
  faturarPara: z.string().regex(/^(empresa:.+|cliente)$/, "Escolha o CNPJ que será faturado."),
  formaPagamento: z.enum(FORMAS_PAGAMENTO as [string, ...string[]], { message: "Escolha a forma de pagamento." }),
  prazoPagamentoDias: z.number().int("Prazo de pagamento em dias inteiros.").min(0).max(720),
  parcelas: z.number().int("Número de parcelas inteiro.").min(1, "Pelo menos 1 parcela.").max(60),
  prazoEntregaDias: z.number().int("Prazo de entrega em dias inteiros.").min(0).nullable(),
  observacoes: z.string().trim().max(2000).optional(),
});

export async function salvarCotacao(
  cotacaoId: string | null,
  _estado: EstadoFormCotacao,
  formData: FormData
): Promise<EstadoFormCotacao> {
  let requisicaoId: string;

  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");
    const marcado = (campo: string) => formData.get(campo) === "on";
    const texto = (campo: string) => String(formData.get(campo) ?? "").trim();

    const incideDifal = marcado("incideDifal");
    const frete = texto("frete") === "fob" ? "fob" : "cif";
    const dados = cotacaoSchema.safeParse({
      requisicaoId: texto("requisicaoId"),
      fornecedorId: texto("fornecedorId"),
      vendedor: texto("vendedor") || undefined,
      incideDifal,
      aliquotaDifal: incideDifal ? numeroBr(texto("aliquotaDifal")) : null,
      valorDifal: incideDifal ? (numeroBr(texto("valorDifal")) ?? 0) : 0,
      frete,
      coletaPropria: frete === "fob" && marcado("coletaPropria"),
      valorFrete: numeroBr(texto("valorFrete")) ?? 0,
      faturarPara: texto("faturarPara"),
      formaPagamento: texto("formaPagamento"),
      prazoPagamentoDias: numeroBr(texto("prazoPagamentoDias")) ?? 0,
      parcelas: numeroBr(texto("parcelas")) ?? 1,
      prazoEntregaDias: numeroBr(texto("prazoEntregaDias")),
      observacoes: texto("observacoes") || undefined,
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
    requisicaoId = dados.data.requisicaoId;

    let precosBrutos: Record<string, string>;
    try {
      precosBrutos = JSON.parse(String(formData.get("precos") ?? "{}"));
    } catch {
      return { erro: "Lista de preços inválida." };
    }

    const { data: itens } = await supabase
      .from("RequisicaoItem")
      .select("id, ordem")
      .eq("requisicaoId", requisicaoId);
    const precos = new Map<string, number>();
    for (const item of itens ?? []) {
      const preco = numeroBr(precosBrutos[item.id]);
      if (preco === null) continue; // fornecedor não cotou este item
      if (!Number.isFinite(preco) || preco < 0) {
        return { erro: `Preço inválido no item ${item.ordem}.` };
      }
      precos.set(item.id, preco);
    }
    if (precos.size === 0) return { erro: "Informe o preço de pelo menos um item." };

    const { data: fornecedor } = await supabase
      .from("Fornecedor")
      .select("id, uf, ativo")
      .eq("id", dados.data.fornecedorId)
      .maybeSingle();
    if (!fornecedor) return { erro: "Fornecedor não encontrado." };

    // Faturamento: CNPJ do grupo (ativo) ou o cliente da obra, com autorização.
    const faturadoCliente = dados.data.faturarPara === "cliente";
    let empresaId: string | null = null;
    if (faturadoCliente) {
      const { data: req } = await supabase
        .from("Requisicao")
        .select("obra:Obra(clienteId)")
        .eq("id", requisicaoId)
        .maybeSingle();
      if (!req?.obra?.clienteId) return { erro: "Só compra de obra com cliente pode ser faturada em nome dele." };
    } else {
      const { data: empresa } = await supabase
        .from("EmpresaGrupo")
        .select("id, ativo")
        .eq("id", dados.data.faturarPara.slice("empresa:".length))
        .maybeSingle();
      if (!empresa) return { erro: "Empresa de faturamento não encontrada." };
      empresaId = empresa.id;
    }
    const anexo = formData.get("autorizacao");
    const arquivoAutorizacao = anexo instanceof File && anexo.size > 0 ? anexo : null;
    if (arquivoAutorizacao && arquivoAutorizacao.size > TAMANHO_MAXIMO_ANEXO) {
      return { erro: "A autorização passa de 10 MB." };
    }
    let autorizacaoAnterior: string | null = null;
    if (faturadoCliente && !arquivoAutorizacao) {
      const { data: atual } = cotacaoId
        ? await supabase.from("Cotacao").select("autorizacaoCaminho").eq("id", cotacaoId).maybeSingle()
        : { data: null };
      if (!atual?.autorizacaoCaminho) {
        return { erro: "Anexe a autorização do cliente (ordem de compra ou print da conversa)." };
      }
    }
    if (cotacaoId && (arquivoAutorizacao || !faturadoCliente)) {
      const { data: atual } = await supabase
        .from("Cotacao")
        .select("autorizacaoCaminho")
        .eq("id", cotacaoId)
        .maybeSingle();
      autorizacaoAnterior = atual?.autorizacaoCaminho ?? null;
    }

    const aberta = await abrirCotacao(requisicaoId, usuarioId);
    if ("erro" in aberta) return { erro: aberta.erro };

    let autorizacao: { autorizacaoCaminho: string | null; autorizacaoNome: string | null } | null = null;
    if (faturadoCliente && arquivoAutorizacao) {
      const caminho = `cotacoes/${requisicaoId}/${crypto.randomUUID()}-${nomeSeguro(arquivoAutorizacao.name)}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivoAutorizacao, { contentType: arquivoAutorizacao.type || undefined });
      if (error) return { erro: "Falha ao enviar a autorização do cliente." };
      autorizacao = { autorizacaoCaminho: caminho, autorizacaoNome: arquivoAutorizacao.name };
    } else if (!faturadoCliente) {
      autorizacao = { autorizacaoCaminho: null, autorizacaoNome: null };
    }
    const pagamento = {
      formaPagamento: dados.data.formaPagamento as (typeof FORMAS_PAGAMENTO)[number],
      prazoPagamentoDias: dados.data.prazoPagamentoDias,
      parcelas: dados.data.parcelas,
    };

    const registro = {
      fornecedorId: fornecedor.id,
      vendedor: dados.data.vendedor ?? null,
      // Copiada agora: se o cadastro mudar depois, a análise desta compra não muda.
      ufOrigem: fornecedor.uf,
      incideDifal: dados.data.incideDifal,
      aliquotaDifal: dados.data.aliquotaDifal,
      valorDifal: dados.data.valorDifal,
      frete: dados.data.frete,
      coletaPropria: dados.data.coletaPropria,
      valorFrete: dados.data.valorFrete,
      condicaoPagamento: textoCondicaoPagamento(pagamento),
      ...pagamento,
      empresaId,
      faturadoCliente,
      ...(autorizacao ?? {}),
      prazoEntregaDias: dados.data.prazoEntregaDias,
      observacoes: dados.data.observacoes ?? null,
    };

    let id = cotacaoId;
    if (id) {
      const { data: alterada, error } = await supabase
        .from("Cotacao")
        .update(registro)
        .eq("id", id)
        .eq("requisicaoId", requisicaoId)
        .select("id");
      if (error) return { erro: traduzirErroCotacao(error) };
      if (!alterada?.length) return { erro: "Cotação não encontrada." };
    } else {
      const { data: nova, error } = await supabase
        .from("Cotacao")
        .insert({ ...registro, requisicaoId, criadoPorId: usuarioId })
        .select("id")
        .single();
      if (error || !nova) return { erro: traduzirErroCotacao(error) };
      id = nova.id;
    }

    // Upsert, e não apagar e recriar: o id de cada preço é o que a escolha do
    // vencedor guarda, e recriar desfaria a escolha já feita.
    const { error: erroPrecos } = await supabase.from("CotacaoItem").upsert(
      [...precos].map(([requisicaoItemId, precoUnitario]) => ({
        cotacaoId: id!,
        requisicaoItemId,
        precoUnitario,
      })),
      { onConflict: "cotacaoId,requisicaoItemId" }
    );
    if (erroPrecos) return { erro: erroPrecos.message };

    // Anexo trocado ou compra que deixou de ser para o cliente: o antigo sai do bucket.
    if (autorizacao && autorizacaoAnterior && autorizacaoAnterior !== autorizacao.autorizacaoCaminho) {
      await supabase.storage.from(BUCKET).remove([autorizacaoAnterior]);
    }

    const semPreco = (itens ?? []).map((i) => i.id).filter((itemId) => !precos.has(itemId));
    if (semPreco.length > 0) {
      // Preço apagado = item não cotado. A escolha que apontava para ele cai
      // sozinha (FK com on delete set null).
      await supabase.from("CotacaoItem").delete().eq("cotacaoId", id!).in("requisicaoItemId", semPreco);
    }
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }

  revalidar(requisicaoId);
  redirect(`/suprimentos/requisicoes/${requisicaoId}/cotacao`);
}

function traduzirErroCotacao(error: { code?: string; message: string } | null) {
  if (error?.code === "23505") return "Este fornecedor já tem cotação nesta requisição. Edite a existente.";
  return error?.message ?? "Falha ao salvar a cotação.";
}

export async function excluirCotacao(
  _estado: { erro?: string } | undefined,
  formData: FormData
): Promise<{ erro?: string } | undefined> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");
    const cotacaoId = String(formData.get("cotacaoId") ?? "");
    const { data: cotacao } = await supabase
      .from("Cotacao")
      .select("id, requisicaoId")
      .eq("id", cotacaoId)
      .maybeSingle();
    if (!cotacao) return { erro: "Cotação não encontrada." };
    const aberta = await abrirCotacao(cotacao.requisicaoId, usuarioId);
    if ("erro" in aberta) return { erro: aberta.erro };

    const { error } = await supabase.from("Cotacao").delete().eq("id", cotacao.id);
    if (error) return { erro: error.message };
    revalidar(cotacao.requisicaoId);
    return undefined;
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

// ---------------------------------------------------------------- escolha

/**
 * Grava quem fornece cada item. `escolhas` mapeia requisicaoItemId → id do preço
 * (CotacaoItem) escolhido, ou null para deixar o item sem fornecedor.
 */
export async function salvarEscolha(
  requisicaoId: string,
  escolhas: Record<string, string | null>
): Promise<Resultado> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");
    const aberta = await abrirCotacao(requisicaoId, usuarioId);
    if ("erro" in aberta) return { erro: aberta.erro };

    const { data: itens } = await supabase
      .from("RequisicaoItem")
      .select("id, cotacaoItemVencedorId")
      .eq("requisicaoId", requisicaoId);
    const { data: precos } = await supabase
      .from("CotacaoItem")
      .select("id, requisicaoItemId, cotacao:Cotacao!inner(requisicaoId)")
      .eq("cotacao.requisicaoId", requisicaoId);

    // Só vale o preço que é do próprio item: impede gravar num item o preço
    // de outro (ou de outra requisição) mandando ids trocados.
    const itemDoPreco = new Map((precos ?? []).map((p) => [p.id, p.requisicaoItemId]));
    const mudancas: { id: string; vencedor: string | null }[] = [];
    for (const item of itens ?? []) {
      if (!(item.id in escolhas)) continue;
      const vencedor = escolhas[item.id] || null;
      if (vencedor && itemDoPreco.get(vencedor) !== item.id) {
        return { erro: "Escolha inválida. Recarregue a página." };
      }
      if (vencedor !== item.cotacaoItemVencedorId) mudancas.push({ id: item.id, vencedor });
    }

    const resultados = await Promise.all(
      mudancas.map((m) =>
        supabase.from("RequisicaoItem").update({ cotacaoItemVencedorId: m.vencedor }).eq("id", m.id)
      )
    );
    const falha = resultados.find((r) => r.error);
    if (falha?.error) return { erro: falha.error.message };

    revalidar(requisicaoId);
    return undefined;
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

