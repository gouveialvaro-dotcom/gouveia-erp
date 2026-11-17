import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { carregarPedido } from "@/lib/suprimentos-pedidos";
import { codigoRequisicao } from "@/lib/suprimentos";
import { DocumentoPedido } from "@/components/suprimentos/documento-pedido";
import { BadgeStatusEntrega } from "@/components/suprimentos/status-requisicao";
import { HistoricoRecebimentos } from "@/components/suprimentos/historico-recebimentos";
import { RegistrarRecebimento } from "@/components/suprimentos/registrar-recebimento";
import { Button } from "@/components/ui/button";

export default async function PaginaPedido({ params }: { params: Promise<{ id: string }> }) {
  const contexto = await contextoSuprimentos();
  const { id } = await params;
  const pedido = await carregarPedido(id);
  // Mesmo critério da requisição: fora do fluxo, só o próprio requisitante.
  if (!pedido || (!contexto.veTodasRequisicoes && pedido.requisicao.requisitanteId !== contexto.usuarioId)) {
    notFound();
  }

  const { data: recebimentosBrutos } = await supabase
    .from("Recebimento")
    .select("*, registradoPor:Usuario!Recebimento_registradoPorId_fkey(nome), fotos:RecebimentoFoto(id, nome)")
    .eq("pedidoCompraId", pedido.id)
    .order("recebidoEm", { ascending: false });
  const recebimentos = (recebimentosBrutos ?? []).map((r) => ({
    ...r,
    registradoPor: r.registradoPor?.nome ?? null,
  }));

  // Mesma regra da action: recebedor, comprador, admin ou o próprio requisitante.
  const podeReceber =
    pedido.statusEntrega !== "recebido_conforme" &&
    (contexto.tem("recebedor", "comprador") || pedido.requisicao.requisitanteId === contexto.usuarioId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">{pedido.codigo}</h2>
            <BadgeStatusEntrega status={pedido.statusEntrega} />
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <Link href="/suprimentos/pedidos" className="hover:underline">
              ← Pedidos
            </Link>
            <Link href={`/suprimentos/requisicoes/${pedido.requisicao.id}`} className="hover:underline">
              Requisição {codigoRequisicao(pedido.requisicao.numero)}
            </Link>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/pedidos-compra/${pedido.id}`} target="_blank" />}
          nativeButton={false}
        >
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      {/* No celular o formulário vem antes do documento: é o que a obra veio fazer. */}
      {podeReceber && (
        <RegistrarRecebimento
          pedidoId={pedido.id}
          nomePadrao={contexto.nome}
          reentrega={pedido.statusEntrega === "recebido_inconforme"}
        />
      )}

      <HistoricoRecebimentos recebimentos={recebimentos} />

      <div className="rounded-md border bg-white p-4 sm:p-6">
        <DocumentoPedido pedido={pedido} />
      </div>
    </div>
  );
}
