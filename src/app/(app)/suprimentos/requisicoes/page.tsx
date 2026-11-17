import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import {
  ROTULO_STATUS_REQUISICAO,
  STATUS_EM_ANDAMENTO,
  codigoRequisicao,
  hojeSaoPaulo,
  type StatusRequisicao,
} from "@/lib/suprimentos";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectNativo } from "@/components/ui/select-nativo";
import { BadgeStatusRequisicao, BadgeUrgencia } from "@/components/suprimentos/status-requisicao";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaRequisicoes({
  searchParams,
}: {
  searchParams: Promise<{ escopo?: string; status?: string }>;
}) {
  const { usuarioId, veTodasRequisicoes } = await contextoSuprimentos();
  const filtros = await searchParams;
  const escopo = veTodasRequisicoes && filtros.escopo !== "minhas" ? "todas" : "minhas";
  const status = filtros.status ?? "andamento";

  let consulta = supabase
    .from("Requisicao")
    .select(
      "id, numero, status, urgencia, prazoDesejado, dataSolicitacao, obra:Obra(nomeProjeto), requisitante:Usuario!Requisicao_requisitanteId_fkey(nome), itens:RequisicaoItem(count)"
    )
    // Emergencial primeiro (o enum ordena normal < emergencial), depois a mais nova.
    .order("urgencia", { ascending: false })
    .order("numero", { ascending: false })
    .limit(200);

  if (escopo === "minhas") consulta = consulta.eq("requisitanteId", usuarioId);
  if (status === "andamento") consulta = consulta.in("status", STATUS_EM_ANDAMENTO);
  else if (status in ROTULO_STATUS_REQUISICAO) consulta = consulta.eq("status", status as StatusRequisicao);

  const { data } = await consulta;
  const requisicoes = data ?? [];
  const hoje = hojeSaoPaulo();

  const link = (params: Record<string, string>) =>
    `/suprimentos/requisicoes?${new URLSearchParams({ escopo, status, ...params })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          {veTodasRequisicoes && (
            <div className="flex rounded-lg border p-0.5 text-sm">
              {(["todas", "minhas"] as const).map((e) => (
                <Link
                  key={e}
                  href={link({ escopo: e })}
                  className={cn(
                    "rounded-md px-3 py-1",
                    escopo === e ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {e === "todas" ? "Todas" : "Minhas"}
                </Link>
              ))}
            </div>
          )}
          <form className="flex items-center gap-2">
            <input type="hidden" name="escopo" value={escopo} />
            <SelectNativo name="status" defaultValue={status} className="w-48">
              <option value="andamento">Em andamento</option>
              <option value="todas">Todas as situações</option>
              {(Object.keys(ROTULO_STATUS_REQUISICAO) as StatusRequisicao[]).map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS_REQUISICAO[s]}
                </option>
              ))}
            </SelectNativo>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
        </div>
        <Button render={<Link href="/suprimentos/requisicoes/nova" />} nativeButton={false}>
          + Nova requisição
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requisição</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Requisitante</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead>Entregar até</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requisicoes.map((r) => {
              const atrasada =
                r.prazoDesejado < hoje && STATUS_EM_ANDAMENTO.includes(r.status) && r.status !== "pedido_emitido";
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/suprimentos/requisicoes/${r.id}`} className="hover:underline font-mono">
                      {codigoRequisicao(r.numero)}
                    </Link>
                    <div className="mt-1">
                      <BadgeUrgencia urgencia={r.urgencia} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">{r.obra?.nomeProjeto ?? "—"}</TableCell>
                  <TableCell>{r.requisitante?.nome ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.itens[0]?.count ?? 0}</TableCell>
                  <TableCell className={cn(atrasada && "text-destructive font-medium")}>
                    {formatarData(r.prazoDesejado)}
                  </TableCell>
                  <TableCell>
                    <BadgeStatusRequisicao status={r.status} />
                  </TableCell>
                </TableRow>
              );
            })}
            {requisicoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma requisição encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
