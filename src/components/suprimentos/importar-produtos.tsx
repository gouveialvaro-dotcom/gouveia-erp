"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { importarProdutos, type ResultadoImportacao } from "@/app/(app)/suprimentos/produtos/actions";
import { chaveDescricao } from "@/lib/suprimentos";
import {
  GRUPOS_EXCLUIDOS_PADRAO,
  ROTULO_GRUPO,
  lerCsvContaAzul,
  origemDoArquivo,
  type GrupoImportacao,
  type LinhaCsv,
} from "@/lib/suprimentos-importacao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GRUPOS: GrupoImportacao[] = ["suprimento", "alimentacao", "combustivel"];

/** O export do Conta Azul sai em Windows-1252; se o arquivo já vier em UTF-8, usa UTF-8. */
async function lerTexto(arquivo: File) {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function ImportarProdutos() {
  const [linhas, setLinhas] = useState<LinhaCsv[]>([]);
  const [arquivos, setArquivos] = useState<{ origem: string; total: number }[]>([]);
  const [incluidos, setIncluidos] = useState<Set<GrupoImportacao>>(
    new Set(GRUPOS.filter((g) => !GRUPOS_EXCLUIDOS_PADRAO.includes(g)))
  );
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [pendente, iniciar] = useTransition();

  async function aoEscolher(lista: FileList | null) {
    setErroLeitura(null);
    setResultado(null);
    if (!lista || lista.length === 0) return;
    try {
      const todas: LinhaCsv[] = [];
      const resumo: { origem: string; total: number }[] = [];
      for (const arquivo of Array.from(lista)) {
        const origem = origemDoArquivo(arquivo.name);
        const lidas = lerCsvContaAzul(await lerTexto(arquivo), origem);
        todas.push(...lidas);
        resumo.push({ origem, total: lidas.length });
      }
      setLinhas(todas);
      setArquivos(resumo);
    } catch (erro) {
      setLinhas([]);
      setArquivos([]);
      setErroLeitura(erro instanceof Error ? erro.message : "Não foi possível ler o arquivo.");
    }
  }

  const porGrupo = useMemo(() => {
    const mapa = new Map<GrupoImportacao, LinhaCsv[]>();
    for (const g of GRUPOS) mapa.set(g, []);
    for (const l of linhas) mapa.get(l.grupo)!.push(l);
    return mapa;
  }, [linhas]);

  const selecionadas = linhas.filter((l) => incluidos.has(l.grupo));
  const produtosDistintos = new Set(selecionadas.map((l) => chaveDescricao(l.descricao))).size;

  function alternar(grupo: GrupoImportacao, marcado: boolean) {
    setIncluidos((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(grupo);
      else novo.delete(grupo);
      return novo;
    });
  }

  function importar() {
    setResultado(null);
    iniciar(async () => {
      const envio = selecionadas.map(({ origem, codigo, ean, descricao, unidade }) => ({
        origem,
        codigo,
        ean,
        descricao,
        unidade,
      }));
      setResultado(await importarProdutos(envio));
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="arquivos">Arquivos CSV exportados do Conta Azul</Label>
        <Input
          id="arquivos"
          type="file"
          accept=".csv,text/csv"
          multiple
          onChange={(e) => aoEscolher(e.target.files)}
        />
        <p className="text-xs text-muted-foreground">
          Pode escolher vários de uma vez. O nome do arquivo é guardado como origem do código
          (por exemplo, o CNPJ de onde ele veio). Reimportar o mesmo arquivo não duplica nada.
        </p>
      </div>

      {erroLeitura && <p className="text-sm text-destructive">{erroLeitura}</p>}

      {arquivos.length > 0 && (
        <>
          <div className="rounded-md border bg-card p-4 text-sm">
            <p className="font-medium mb-2">Arquivos lidos</p>
            <ul className="flex flex-col gap-1">
              {arquivos.map((a) => (
                <li key={a.origem}>
                  {a.origem}: <span className="font-medium">{a.total}</span> linhas
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            {GRUPOS.map((grupo) => {
              const doGrupo = porGrupo.get(grupo) ?? [];
              if (doGrupo.length === 0) return null;
              const exemplos = [...new Set(doGrupo.map((l) => l.descricao))].slice(0, 8);
              return (
                <div key={grupo} className="rounded-md border bg-card p-4">
                  <Label className="flex items-center gap-2 font-medium">
                    <Checkbox
                      checked={incluidos.has(grupo)}
                      onCheckedChange={(v) => alternar(grupo, v === true)}
                    />
                    {ROTULO_GRUPO[grupo]} — {doGrupo.length} linhas
                  </Label>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ex.: {exemplos.join(" · ")}
                    {doGrupo.length > exemplos.length ? " …" : ""}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={importar} disabled={pendente || selecionadas.length === 0}>
              {pendente
                ? "Importando..."
                : `Importar ${produtosDistintos} produtos (${selecionadas.length} códigos)`}
            </Button>
            <p className="text-xs text-muted-foreground">
              Itens com a mesma descrição viram um produto só, com um código por arquivo. Todos
              entram marcados &quot;a revisar&quot; para conferência de unidade e categoria.
            </p>
          </div>
        </>
      )}

      {resultado && "erro" in resultado && (
        <p className="text-sm text-destructive">{resultado.erro}</p>
      )}
      {resultado && !("erro" in resultado) && (
        <div className="rounded-md border border-emerald-600/40 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
          <p className="font-medium">Importação concluída.</p>
          <p>
            {resultado.produtosNovos} produtos novos · {resultado.produtosExistentes} já
            existiam · {resultado.codigosNovos} códigos do Conta Azul vinculados.
          </p>
          <Link href="/suprimentos/produtos?revisar=1" className="underline">
            Ver produtos a revisar
          </Link>
        </div>
      )}
    </div>
  );
}
