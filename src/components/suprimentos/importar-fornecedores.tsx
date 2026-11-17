"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  importarFornecedores,
  type ResultadoImportacaoFornecedores,
} from "@/app/(app)/suprimentos/fornecedores/actions";
import { formatarCnpj } from "@/lib/suprimentos";
import { lerCsvFornecedores, type LeituraFornecedores } from "@/lib/suprimentos-importacao-fornecedores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AMOSTRA = 15;

/** O Conta Azul exporta em UTF-8; se vier em Windows-1252 (salvo de novo no Excel), usa esse. */
async function lerTexto(arquivo: File) {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xl font-semibold">{valor}</div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
    </div>
  );
}

export function ImportarFornecedores() {
  const [leitura, setLeitura] = useState<LeituraFornecedores | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacaoFornecedores | null>(null);
  const [pendente, iniciar] = useTransition();

  async function aoEscolher(lista: FileList | null) {
    setErroLeitura(null);
    setResultado(null);
    setLeitura(null);
    const arquivo = lista?.[0];
    if (!arquivo) return;
    try {
      setLeitura(lerCsvFornecedores(await lerTexto(arquivo)));
    } catch (erro) {
      setErroLeitura(erro instanceof Error ? erro.message : "Não foi possível ler o arquivo.");
    }
  }

  function importar() {
    if (!leitura) return;
    setResultado(null);
    iniciar(async () => setResultado(await importarFornecedores(leitura.linhas)));
  }

  const linhas = leitura?.linhas ?? [];
  const comCnpj = linhas.filter((l) => l.documento?.length === 14).length;
  const comCpf = linhas.filter((l) => l.documento?.length === 11).length;
  const semUf = linhas.filter((l) => !l.uf).length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="arquivo">Planilha de fornecedores (CSV)</Label>
        <Input id="arquivo" type="file" accept=".csv,text/csv" onChange={(e) => aoEscolher(e.target.files)} />
        <p className="text-xs text-muted-foreground">
          Endereço, CEP e inscrição estadual vão para as observações do fornecedor. Reimportar a
          mesma planilha não duplica nada.
        </p>
      </div>

      {erroLeitura && <p className="text-sm text-destructive">{erroLeitura}</p>}

      {leitura && (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Numero valor={linhas.length} rotulo="fornecedores no arquivo" />
            <Numero valor={comCnpj} rotulo="com CNPJ" />
            <Numero valor={comCpf} rotulo="com CPF (pessoa física)" />
            <Numero valor={linhas.length - comCnpj - comCpf} rotulo="sem documento" />
          </div>

          <ul className="flex flex-col gap-1 text-sm text-muted-foreground list-disc pl-5">
            {semUf > 0 && (
              <li>
                {semUf} sem UF na planilha. Entram sem UF, e o alerta de DIFAL não aparece para eles
                até alguém completar o cadastro.
              </li>
            )}
            {leitura.repetidos > 0 && (
              <li>{leitura.repetidos} repetidos no arquivo (mesmo CNPJ/CPF ou mesmo nome): vale a primeira linha.</li>
            )}
            {leitura.semNome > 0 && <li>{leitura.semNome} linhas sem nome foram ignoradas.</li>}
            {leitura.documentoInvalido.length > 0 && (
              <li>
                {leitura.documentoInvalido.length} com CNPJ/CPF inválido entram sem documento:{" "}
                {leitura.documentoInvalido.slice(0, 5).join("; ")}
                {leitura.documentoInvalido.length > 5 ? " …" : ""}
              </li>
            )}
          </ul>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>CNPJ / CPF</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.slice(0, AMOSTRA).map((l, i) => (
                  <TableRow key={`${l.documento ?? l.razaoSocial}-${i}`}>
                    <TableCell className="font-medium">
                      {l.razaoSocial}
                      {l.nomeFantasia && (
                        <div className="text-xs text-muted-foreground">{l.nomeFantasia}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {l.documento ? formatarCnpj(l.documento) : "—"}
                    </TableCell>
                    <TableCell>{[l.cidade, l.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[l.telefone, l.email].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {linhas.length > AMOSTRA && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Mostrando {AMOSTRA} de {linhas.length}.
              </p>
            )}
          </div>

          <div>
            <Button onClick={importar} disabled={pendente || linhas.length === 0}>
              {pendente ? "Importando..." : `Importar ${linhas.length} fornecedores`}
            </Button>
          </div>
        </>
      )}

      {resultado && "erro" in resultado && <p className="text-sm text-destructive">{resultado.erro}</p>}
      {resultado && !("erro" in resultado) && (
        <div className="rounded-md border border-emerald-600/40 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
          <p className="font-medium">Importação concluída.</p>
          <p>
            {resultado.novos} fornecedores novos · {resultado.existentes} já existiam
            {resultado.completados > 0
              ? ` (${resultado.completados} tiveram campos em branco completados)`
              : ""}
            .
          </p>
          <Link href="/suprimentos/fornecedores" className="underline">
            Ver fornecedores
          </Link>
        </div>
      )}
    </div>
  );
}
