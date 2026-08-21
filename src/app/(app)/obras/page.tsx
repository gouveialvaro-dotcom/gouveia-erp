import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData, formatarMoeda } from "@/lib/format";
import { ROTULO_STATUS_OBRA } from "@/lib/obras";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { criarObra } from "./actions";

export default async function PaginaObras() {
  const { perfil } = await acessoModulo("obras");
  const podeEditar = podeEscrever(perfil, "obras");

  const { data: obrasData } = await supabase
    .from("Obra")
    .select(
      "*, oportunidade:Oportunidade(cliente:Cliente(razaoSocial), orcamento:Orcamento(nomeProjeto))"
    )
    .order("criadoEm", { ascending: false });

  const obras = obrasData ?? [];

  let oportunidadesAguardando: { id: string; cliente: string; projeto: string }[] = [];
  if (podeEditar) {
    const [{ data: aprovadas }, { data: comObra }] = await Promise.all([
      supabase
        .from("Oportunidade")
        .select("id, cliente:Cliente(razaoSocial), orcamento:Orcamento(nomeProjeto)")
        .eq("estagio", "aprovada"),
      supabase.from("Obra").select("oportunidadeId"),
    ]);

    const idsComObra = new Set((comObra ?? []).map((o) => o.oportunidadeId));
    oportunidadesAguardando = (aprovadas ?? [])
      .filter((o) => !idsComObra.has(o.id))
      .map((o) => ({
        id: o.id,
        cliente: o.cliente?.razaoSocial ?? "—",
        projeto: o.orcamento?.nomeProjeto ?? "—",
      }));
  }

  const hoje = new Date().toLocaleDateString("sv-SE");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Obras</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhamento pós-venda — {obras.length} obra(s)
        </p>
      </div>

      {podeEditar && oportunidadesAguardando.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Oportunidades aprovadas aguardando início de obra
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {oportunidadesAguardando.map((o) => (
              <form
                key={o.id}
                action={criarObra.bind(null, o.id)}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end"
              >
                <div className="text-sm">
                  <p className="font-medium">{o.cliente}</p>
                  <p className="text-muted-foreground text-xs">{o.projeto}</p>
                </div>
                <Input
                  name="custoOrcado"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Custo orçado (R$)"
                  className="w-40"
                  required
                />
                <CampoData name="dataInicio" className="w-40" />
                <Button type="submit" variant="secondary">
                  + Iniciar obra
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Avanço físico</TableHead>
              <TableHead>Custo orçado</TableHead>
              <TableHead>Custo realizado</TableHead>
              <TableHead>Previsão de conclusão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {obras.map((obra) => {
              const atrasada =
                obra.status !== "concluida" &&
                !!obra.dataPrevistaConclusao &&
                obra.dataPrevistaConclusao.slice(0, 10) < hoje;
              const status = ROTULO_STATUS_OBRA[obra.status] ?? {
                texto: obra.status,
                variant: "outline" as const,
              };
              return (
                <TableRow key={obra.id}>
                  <TableCell className="font-medium">
                    <Link href={`/obras/${obra.id}`} className="hover:underline">
                      {obra.oportunidade?.cliente?.razaoSocial ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{obra.oportunidade?.orcamento?.nomeProjeto ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={atrasada ? "destructive" : status.variant}>
                      {atrasada ? "Atrasada" : status.texto}
                    </Badge>
                  </TableCell>
                  <TableCell>{obra.avancoFisicoPercent}%</TableCell>
                  <TableCell>{formatarMoeda(obra.custoOrcado)}</TableCell>
                  <TableCell>{formatarMoeda(obra.custoRealizado)}</TableCell>
                  <TableCell>
                    {obra.dataPrevistaConclusao ? formatarData(obra.dataPrevistaConclusao) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {obras.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma obra iniciada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
