import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { ROTULO_STATUS_ENTREGA, codigoRequisicao, hojeSaoPaulo, somarDiasIso, type StatusEntregaPedido,
  nomeCentroCusto,
} from "@/lib/suprimentos";
import { moeda } from "@/lib/suprimentos-cotacao";
import { termoBusca } from "@/lib/suprimentos-busca";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { BadgeStatusEntrega, BadgeUrgencia } from "@/components/suprimentos/status-requisicao";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Pedidos emitidos. Quem trabalha o fluxo vê todos; o requisitante, os das
// requisições dele. Padrão: os que ainda esperam entrega, mais antigos primeiro.

export default async function PaginaPedidos({
  searchParams,
}: {
  searchParams: Promise<{ entrega?: string; q?: string }>;
}) {
  const { usuarioId, veTodasRequisicoes, exigirAba } = await contextoSuprimentos();
  exigirAba("pedidos");
  const filtros = await searchParams;
  const entrega = filtros.entrega ?? "abertos";
  const termo = termoBusca(filtros.q);

  let consulta = supabase
    .from("PedidoCompra")
    .select(
      `id, codigo, statusEntrega, compraConfirmadaEm, valorTotal, valorItens, valorFrete, frete, emitidoEm, prazoEntregaDias,
       fornecedor:Fornecedor!inner(razaoSocial, nomeFantasia),
       requisicao:Requisicao!inner(id, numero, urgencia, requisitanteId, obra:Obra(nomeProjeto), centroCusto:CentroCusto(nome))`
    )
    .order("emitidoEm", { ascending: entrega === "abertos" || entrega === "pendente" || entrega === "a_comprar" })
    .limit(200);

  if (!veTodasRequisicoes) consulta = consulta.eq("requisicao.requisitanteId", usuarioId);
  if (entrega === "abertos") consulta = consulta.in("statusEntrega", ["pendente", "recebido_parcial"]);
  else if (entrega === "a_comprar") consulta = consulta.is("compraConfirmadaEm", null);
  else if (entrega === "pendente") {
    consulta = consulta.not("compraConfirmadaEm", "is", null).in("statusEntrega", ["pendente", "recebido_parcial"]);
  } else if (entrega in ROTULO_STATUS_ENTREGA) {
    consulta = consulta.eq("statusEntrega", entrega as StatusEntregaPedido);
  }
  if (termo) {
    consulta = consulta.or(
      `razaoSocial.ilike.%${termo}%,nomeFantasia.ilike.%${termo}%`,
      { referencedTable: "fornecedor" }
    );
  }

  const { data } = await consulta;
  const pedidos = data ?? [];
  const hoje = hojeSaoPaulo();

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={filtros.q ?? ""} placeholder="Fornecedor" className="w-56" />
        <SelectNativo name="entrega" defaultValue={entrega} className="w-48">
          <option value="abertos">Em aberto</option>
          <option value="a_comprar">Aguardando confirmação da compra</option>
          <option value="pendente">Entrega pendente</option>
          <option value="recebido_conforme">Recebidos conforme</option>
          <option value="recebido_inconforme">Encerrados com pendência</option>
          <option value="todos">Todos</option>
        </SelectNativo>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Centro de custo</TableHead>
              <TableHead>Emitido</TableHead>
              <TableHead>Previsão</TableHead>
              <TableHead className="text-right">Custo total</TableHead>
              <TableHead>Entrega</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((p) => {
              const emitido = new Date(p.emitidoEm).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
              const previsao = p.prazoEntregaDias === null ? null : somarDiasIso(emitido, p.prazoEntregaDias);
              const atrasado = p.statusEntrega === "pendente" && previsao !== null && previsao < hoje;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/suprimentos/pedidos/${p.id}`} className="font-mono font-medium hover:underline">
                      {p.codigo}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {codigoRequisicao(p.requisicao.numero)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {p.fornecedor.nomeFantasia || p.fornecedor.razaoSocial}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="flex flex-wrap items-center gap-1">
                      {nomeCentroCusto(p.requisicao)}
                      <BadgeUrgencia urgencia={p.requisicao.urgencia} />
                    </span>
                  </TableCell>
                  <TableCell>{formatarData(emitido)}</TableCell>
                  <TableCell className={cn(atrasado && "font-medium text-destructive")}>
                    {previsao ? formatarData(previsao) : "—"}
                    {atrasado && <span className="block text-xs">atrasado</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{moeda(Number(p.valorTotal))}</TableCell>
                  <TableCell>
                    <BadgeStatusEntrega status={p.statusEntrega} compraConfirmada={Boolean(p.compraConfirmadaEm)} />
                  </TableCell>
                </TableRow>
              );
            })}
            {pedidos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum pedido.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
