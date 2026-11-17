import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { hojeSaoPaulo, somarDiasIso } from "@/lib/suprimentos";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BadgeStatusEntrega, BadgeUrgencia } from "@/components/suprimentos/status-requisicao";

// Porta de entrada da obra, pensada para o celular: os pedidos que ainda
// esperam entrega (ou o restante de uma entrega inconforme), em cartões
// grandes. Emergencial primeiro, depois a previsão mais antiga.

export default async function PaginaRecebimentos() {
  const contexto = await contextoSuprimentos();
  const veTodos = contexto.tem("recebedor", "comprador");

  let consulta = supabase
    .from("PedidoCompra")
    .select(
      `id, codigo, statusEntrega, emitidoEm, prazoEntregaDias,
       fornecedor:Fornecedor(razaoSocial, nomeFantasia),
       itens:PedidoCompraItem(count),
       requisicao:Requisicao!inner(numero, urgencia, requisitanteId, obra:Obra(nomeProjeto))`
    )
    .in("statusEntrega", ["pendente", "recebido_inconforme"])
    .limit(200);
  if (!veTodos) consulta = consulta.eq("requisicao.requisitanteId", contexto.usuarioId);

  const { data } = await consulta;
  const hoje = hojeSaoPaulo();
  const pedidos = (data ?? [])
    .map((p) => {
      const emitido = new Date(p.emitidoEm).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      return { ...p, previsao: p.prazoEntregaDias === null ? null : somarDiasIso(emitido, p.prazoEntregaDias) };
    })
    .sort((a, b) => {
      const urg = Number(b.requisicao.urgencia === "emergencial") - Number(a.requisicao.urgencia === "emergencial");
      return urg || (a.previsao ?? "9999").localeCompare(b.previsao ?? "9999");
    });

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Toque no pedido quando o material chegar para registrar se veio conforme.
      </p>
      {pedidos.map((p) => {
        const itens = p.itens[0]?.count ?? 0;
        const atrasado = p.previsao !== null && p.previsao < hoje;
        return (
          <Link
            key={p.id}
            href={`/suprimentos/pedidos/${p.id}`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:bg-muted active:bg-muted"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{p.codigo}</span>
                <BadgeUrgencia urgencia={p.requisicao.urgencia} />
                {p.statusEntrega !== "pendente" && <BadgeStatusEntrega status={p.statusEntrega} />}
              </div>
              <span className="truncate text-sm font-medium">
                {p.fornecedor?.nomeFantasia || p.fornecedor?.razaoSocial}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {p.requisicao.obra?.nomeProjeto ?? "—"} · {itens} {itens === 1 ? "item" : "itens"}
              </span>
              <span className={cn("text-xs", atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>
                {p.previsao ? `Previsão ${formatarData(p.previsao)}${atrasado ? " · atrasado" : ""}` : "Sem previsão"}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        );
      })}
      {pedidos.length === 0 && (
        <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma entrega pendente.
        </p>
      )}
    </div>
  );
}
