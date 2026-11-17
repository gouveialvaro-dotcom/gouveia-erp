"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { documentoValido, normalizarCnpj, UFS } from "@/lib/suprimentos";
import { chaveFornecedor } from "@/lib/suprimentos-importacao-fornecedores";
import type { Database } from "@/lib/database.types";

export type EstadoFormFornecedor = { erro?: string } | undefined;

const opcional = (valor: FormDataEntryValue | null) => String(valor ?? "").trim() || undefined;

const fornecedorSchema = z.object({
  razaoSocial: z.string().trim().min(1, "Informe a razão social ou o nome."),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  uf: z.enum(UFS, { message: "Selecione a UF do fornecedor." }),
  cidade: z.string().optional(),
  vendedor: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido.").optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean(),
});

export async function salvarFornecedor(
  fornecedorId: string | null,
  _estado: EstadoFormFornecedor,
  formData: FormData
): Promise<EstadoFormFornecedor> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");

    const dados = fornecedorSchema.safeParse({
      razaoSocial: formData.get("razaoSocial"),
      nomeFantasia: opcional(formData.get("nomeFantasia")),
      cnpj: opcional(formData.get("cnpj")),
      uf: opcional(formData.get("uf")),
      cidade: opcional(formData.get("cidade")),
      vendedor: opcional(formData.get("vendedor")),
      telefone: opcional(formData.get("telefone")),
      email: opcional(formData.get("email")),
      observacoes: opcional(formData.get("observacoes")),
      ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
    if (dados.data.cnpj && !documentoValido(dados.data.cnpj)) return { erro: "CNPJ ou CPF inválido." };

    const registro = {
      razaoSocial: dados.data.razaoSocial,
      nomeFantasia: dados.data.nomeFantasia ?? null,
      cnpj: dados.data.cnpj ? normalizarCnpj(dados.data.cnpj) : null,
      uf: dados.data.uf,
      cidade: dados.data.cidade ?? null,
      vendedor: dados.data.vendedor ?? null,
      telefone: dados.data.telefone ?? null,
      email: dados.data.email ?? null,
      observacoes: dados.data.observacoes ?? null,
      ativo: dados.data.ativo,
    };

    const { error } = fornecedorId
      ? await supabase.from("Fornecedor").update(registro).eq("id", fornecedorId)
      : await supabase.from("Fornecedor").insert({ ...registro, criadoPorId: usuarioId });

    if (error) {
      if (error.code === "23505") return { erro: "Já existe um fornecedor com este CNPJ/CPF." };
      return { erro: error.message };
    }
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }

  revalidatePath("/suprimentos/fornecedores");
  redirect("/suprimentos/fornecedores");
}

// ---------------------------------------------------------------------------
// Importação da planilha de fornecedores do Conta Azul.
//
// O navegador lê o arquivo e mostra a prévia; aqui o servidor revalida e grava.
// Fornecedor já cadastrado (mesmo CNPJ/CPF ou, sem documento, mesmo nome) não
// é sobrescrito: só ganha os campos que estavam vazios. Reimportar a mesma
// planilha não duplica nada.

const texto = (max: number) => z.string().trim().max(max).optional();

const linhaFornecedorSchema = z.object({
  razaoSocial: z.string().trim().min(2).max(200),
  nomeFantasia: texto(200),
  documento: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/)
    .refine(documentoValido)
    .optional(),
  uf: z.enum(UFS).optional(),
  cidade: texto(100),
  vendedor: texto(100),
  telefone: texto(40),
  email: z.string().trim().email().max(200).optional(),
  observacoes: texto(1000),
  ativo: z.boolean(),
});

export type ResultadoImportacaoFornecedores =
  | { erro: string }
  | { novos: number; existentes: number; completados: number };

const CAMPOS_COMPLETAVEIS = ["nomeFantasia", "uf", "cidade", "vendedor", "telefone", "email", "observacoes"] as const;
const LOTE_FORNECEDORES = 500;

export async function importarFornecedores(linhas: unknown): Promise<ResultadoImportacaoFornecedores> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");

    const validacao = z.array(linhaFornecedorSchema).max(5000).safeParse(linhas);
    if (!validacao.success) return { erro: "Planilha com linhas inválidas. Nada foi gravado." };
    if (validacao.data.length === 0) return { erro: "Nenhum fornecedor para importar." };

    // A tabela é pequena (centenas): carrega tudo e casa em memória.
    const { data: atuais, error: erroLeitura } = await supabase.from("Fornecedor").select("*");
    if (erroLeitura) return { erro: erroLeitura.message };
    const porDocumento = new Map((atuais ?? []).filter((f) => f.cnpj).map((f) => [f.cnpj!, f]));
    const porNome = new Map(
      (atuais ?? []).filter((f) => !f.cnpj).map((f) => [chaveFornecedor(f.razaoSocial), f])
    );

    const novos: Database["public"]["Tables"]["Fornecedor"]["Insert"][] = [];
    const nomesNovos = new Set<string>();
    let existentes = 0;
    let completados = 0;

    for (const linha of validacao.data) {
      const chave = chaveFornecedor(linha.razaoSocial);
      // Cadastrado às pressas na cotação, sem CNPJ: casa pelo nome e ganha o documento.
      const atual = (linha.documento && porDocumento.get(linha.documento)) || porNome.get(chave);
      if (atual) {
        existentes++;
        const complemento: Partial<Record<(typeof CAMPOS_COMPLETAVEIS)[number] | "cnpj", string>> = {};
        for (const campo of CAMPOS_COMPLETAVEIS) {
          if (!atual[campo] && linha[campo]) complemento[campo] = linha[campo];
        }
        if (!atual.cnpj && linha.documento) {
          complemento.cnpj = linha.documento;
          porNome.delete(chave);
          porDocumento.set(linha.documento, { ...atual, cnpj: linha.documento });
        }
        if (Object.keys(complemento).length > 0) {
          const { error } = await supabase.from("Fornecedor").update(complemento).eq("id", atual.id);
          if (error) return { erro: error.message };
          completados++;
        }
        continue;
      }
      // Sem documento, o nome é a chave: duas linhas iguais no arquivo viram uma.
      if (!linha.documento) {
        if (nomesNovos.has(chave)) continue;
        nomesNovos.add(chave);
      }
      novos.push({
        razaoSocial: linha.razaoSocial,
        nomeFantasia: linha.nomeFantasia ?? null,
        cnpj: linha.documento ?? null,
        uf: linha.uf ?? null,
        cidade: linha.cidade ?? null,
        vendedor: linha.vendedor ?? null,
        telefone: linha.telefone ?? null,
        email: linha.email ?? null,
        observacoes: linha.observacoes ?? null,
        ativo: linha.ativo,
        criadoPorId: usuarioId,
      });
    }

    for (let i = 0; i < novos.length; i += LOTE_FORNECEDORES) {
      const { error } = await supabase
        .from("Fornecedor")
        .upsert(novos.slice(i, i + LOTE_FORNECEDORES), { onConflict: "cnpj", ignoreDuplicates: true });
      if (error) return { erro: error.message };
    }

    revalidatePath("/suprimentos", "layout");
    return { novos: novos.length, existentes, completados };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}
