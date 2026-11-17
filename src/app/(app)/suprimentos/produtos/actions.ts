"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { chaveDescricao } from "@/lib/suprimentos";

export type EstadoFormProduto = { erro?: string } | undefined;

const produtoSchema = z.object({
  descricao: z.string().trim().min(3, "Descreva o produto."),
  unidade: z.string().trim().min(1, "Informe a unidade.").max(10, "Unidade muito longa."),
  categoria: z.string().trim().optional(),
  tipo: z.enum(["material", "servico", "locacao"]),
  observacoes: z.string().trim().optional(),
  ativo: z.boolean(),
  revisar: z.boolean(),
});

const marcado = (formData: FormData, campo: string) =>
  formData.get(campo) === "on" || formData.get(campo) === "true";

export async function salvarProduto(
  produtoId: string | null,
  _estado: EstadoFormProduto,
  formData: FormData
): Promise<EstadoFormProduto> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");

    const dados = produtoSchema.safeParse({
      descricao: formData.get("descricao"),
      unidade: formData.get("unidade"),
      categoria: String(formData.get("categoria") ?? "").trim() || undefined,
      tipo: formData.get("tipo"),
      observacoes: String(formData.get("observacoes") ?? "").trim() || undefined,
      ativo: marcado(formData, "ativo"),
      revisar: marcado(formData, "revisar"),
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    const registro = {
      descricao: dados.data.descricao.replace(/\s+/g, " "),
      chaveDescricao: chaveDescricao(dados.data.descricao),
      unidade: dados.data.unidade.toUpperCase(),
      categoria: dados.data.categoria ?? null,
      tipo: dados.data.tipo,
      observacoes: dados.data.observacoes ?? null,
      ativo: dados.data.ativo,
      revisar: dados.data.revisar,
      atualizadoEm: new Date().toISOString(),
    };

    const { error } = produtoId
      ? await supabase.from("Produto").update(registro).eq("id", produtoId)
      : await supabase.from("Produto").insert({ ...registro, criadoPorId: usuarioId });

    if (error) {
      if (error.code === "23505") return { erro: "Já existe um produto com esta descrição." };
      return { erro: error.message };
    }
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }

  revalidatePath("/suprimentos/produtos");
  redirect("/suprimentos/produtos");
}

// ---------------------------------------------------------------------------
// Importação dos CSVs do Conta Azul.
//
// O navegador lê e filtra os arquivos (e mostra a prévia); aqui o servidor
// revalida tudo, junta pela chave de descrição e grava. Reimportar o mesmo
// arquivo não duplica nada: produto casa pela chave e código pela (origem,
// código).

const linhaImportacaoSchema = z.object({
  origem: z.string().trim().min(1).max(120),
  codigo: z.string().trim().min(1).max(60),
  ean: z.string().trim().max(30).optional(),
  descricao: z.string().trim().min(2).max(300),
  unidade: z.string().trim().min(1).max(10),
});

export type ResultadoImportacao =
  | { erro: string }
  | { produtosNovos: number; produtosExistentes: number; codigosNovos: number };

const LOTE = 500;

export async function importarProdutos(linhas: unknown): Promise<ResultadoImportacao> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");

    const validacao = z.array(linhaImportacaoSchema).max(10000).safeParse(linhas);
    if (!validacao.success) return { erro: "Arquivo com linhas inválidas. Nada foi gravado." };
    const itens = validacao.data;
    if (itens.length === 0) return { erro: "Nenhum produto selecionado para importar." };

    // Um produto por chave de descrição; o primeiro nome visto vira a descrição.
    const porChave = new Map<string, { descricao: string; unidade: string }>();
    for (const item of itens) {
      const chave = chaveDescricao(item.descricao);
      if (!porChave.has(chave)) {
        porChave.set(chave, {
          descricao: item.descricao.replace(/\s+/g, " ").trim(),
          unidade: item.unidade.toUpperCase(),
        });
      }
    }

    const chaves = [...porChave.keys()];
    const idPorChave = new Map<string, string>();
    for (let i = 0; i < chaves.length; i += LOTE) {
      const { data, error } = await supabase
        .from("Produto")
        .select("id, chaveDescricao")
        .in("chaveDescricao", chaves.slice(i, i + LOTE));
      if (error) return { erro: error.message };
      for (const p of data ?? []) idPorChave.set(p.chaveDescricao, p.id);
    }
    const produtosExistentes = idPorChave.size;

    const novos = chaves
      .filter((chave) => !idPorChave.has(chave))
      .map((chave) => ({
        chaveDescricao: chave,
        descricao: porChave.get(chave)!.descricao,
        unidade: porChave.get(chave)!.unidade,
        tipo: "material" as const,
        revisar: true,
        criadoPorId: usuarioId,
      }));

    for (let i = 0; i < novos.length; i += LOTE) {
      const { data, error } = await supabase
        .from("Produto")
        .upsert(novos.slice(i, i + LOTE), { onConflict: "chaveDescricao", ignoreDuplicates: true })
        .select("id, chaveDescricao");
      if (error) return { erro: error.message };
      for (const p of data ?? []) idPorChave.set(p.chaveDescricao, p.id);
    }

    // Código por (origem, código). Se o mesmo par aparecer duas vezes no lote,
    // vale a primeira linha.
    const vistos = new Set<string>();
    const codigos = [];
    for (const item of itens) {
      const par = `${item.origem}\u0000${item.codigo}`;
      if (vistos.has(par)) continue;
      vistos.add(par);
      const produtoId = idPorChave.get(chaveDescricao(item.descricao));
      if (!produtoId) continue;
      codigos.push({
        produtoId,
        origem: item.origem,
        codigo: item.codigo,
        ean: item.ean || null,
      });
    }

    let codigosNovos = 0;
    for (let i = 0; i < codigos.length; i += LOTE) {
      const { data, error } = await supabase
        .from("ProdutoCodigoExterno")
        .upsert(codigos.slice(i, i + LOTE), { onConflict: "origem,codigo", ignoreDuplicates: true })
        .select("id");
      if (error) return { erro: error.message };
      codigosNovos += data?.length ?? 0;
    }

    revalidatePath("/suprimentos", "layout");
    return { produtosNovos: novos.length, produtosExistentes, codigosNovos };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}
