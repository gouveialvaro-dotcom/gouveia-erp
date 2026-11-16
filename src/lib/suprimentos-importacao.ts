import { chaveDescricao } from "@/lib/suprimentos";

// Leitura e triagem dos CSVs de produtos exportados do Conta Azul. Roda no
// navegador (prévia) — o servidor revalida tudo antes de gravar.
//
// Formato do export: separado por ";", codificação Windows-1252, cabeçalho
// "Código;EAN;Nome do Produto;Valor de Venda;Qt. Estoque;...". Preço e estoque
// vêm zerados e não são usados: o catálogo de Suprimentos não guarda preço.

export type LinhaCsv = {
  origem: string;
  codigo: string;
  ean?: string;
  descricao: string;
  unidade: string;
  grupo: GrupoImportacao;
};

export type GrupoImportacao = "suprimento" | "alimentacao" | "combustivel";

export const ROTULO_GRUPO: Record<GrupoImportacao, string> = {
  suprimento: "Suprimentos de obra, insumos, peças e equipamentos",
  alimentacao: "Refeições, alimentos e bebidas",
  combustivel: "Combustíveis",
};

/** Grupos que ficam fora por padrão (decisão do escopo: são despesas de caixinha). */
export const GRUPOS_EXCLUIDOS_PADRAO: GrupoImportacao[] = ["alimentacao", "combustivel"];

const RE_ALIMENTACAO =
  /CESTA TIPO|\b(ALMOCO|JANTA|LANCHE|CAFE DA MANHA|REFEICAO|MARMITA|ACUCAR|ARROZ|FEIJAO|FARINHA|MACARRAO|OLEO DE SOJA|SAL IODADO|COLORAU|RAPADURA|BOLACHA|FLOCAO|CAFE|COCA-COLA|REFRIGERANTE|AGUA MINERAL|GELO|GELEIAS?|DOCE)\b/;
const RE_COMBUSTIVEL = /\b(GASOLINA|DIESEL|ETANOL)\b/;

export function grupoDoProduto(descricao: string): GrupoImportacao {
  const chave = chaveDescricao(descricao);
  if (RE_COMBUSTIVEL.test(chave)) return "combustivel";
  if (RE_ALIMENTACAO.test(chave)) return "alimentacao";
  return "suprimento";
}

/**
 * Unidade deduzida pelo nome. É um palpite conservador: na dúvida, UN — e todo
 * produto importado nasce marcado "a revisar".
 */
export function unidadeProvavel(descricao: string) {
  const chave = chaveDescricao(descricao);
  if (/\bKG \(QUILO\)|\bGRANEL\b/.test(chave)) return "KG";
  if (/^(AREIA|BRITA|CASCALHO|PO DE PEDRA|PEDRA)\b/.test(chave)) return "M3";
  if (/\bEM METRO\b|\bMETRO LINEAR\b/.test(chave)) return "M";
  return "UN";
}

/** Nome do arquivo sem extensão vira a origem (o CNPJ de onde o código veio). */
export function origemDoArquivo(nomeArquivo: string) {
  return nomeArquivo.replace(/\.[^.]+$/, "").trim();
}

function dividirLinhaCsv(linha: string) {
  // O export não usa aspas; ainda assim, respeita campo entre aspas se vier.
  const campos: string[] = [];
  let atual = "";
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else entreAspas = !entreAspas;
    } else if (c === ";" && !entreAspas) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

export function lerCsvContaAzul(texto: string, origem: string): LinhaCsv[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length === 0) return [];

  const cabecalho = dividirLinhaCsv(linhas[0]).map((c) => chaveDescricao(c));
  const idxCodigo = cabecalho.findIndex((c) => c.startsWith("CODIGO"));
  const idxEan = cabecalho.findIndex((c) => c === "EAN");
  const idxNome = cabecalho.findIndex((c) => c.startsWith("NOME DO PRODUTO"));
  if (idxCodigo < 0 || idxNome < 0) {
    throw new Error(
      `"${origem}" não parece um export de produtos do Conta Azul (faltam as colunas Código e Nome do Produto).`
    );
  }

  const resultado: LinhaCsv[] = [];
  for (const linha of linhas.slice(1)) {
    const campos = dividirLinhaCsv(linha);
    const codigo = campos[idxCodigo] ?? "";
    const descricao = (campos[idxNome] ?? "").replace(/\s+/g, " ").trim();
    if (!codigo || descricao.length < 2) continue;
    resultado.push({
      origem,
      codigo,
      ean: idxEan >= 0 && campos[idxEan] ? campos[idxEan] : undefined,
      descricao,
      unidade: unidadeProvavel(descricao),
      grupo: grupoDoProduto(descricao),
    });
  }
  return resultado;
}
