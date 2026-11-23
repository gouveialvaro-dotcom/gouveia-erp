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
import { ConfirmarCompra } from "@/components/suprimentos/confirmar-compra";
import { formatarDataHora } from "@/lib/format";
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
    .select(
      "*, registradoPor:Usuario!Recebimento_registradoPorId_fkey(nome), fotos:RecebimentoFoto(id, nome), itens:RecebimentoItem(quantidadeRecebida, quantidadeDevolvida, item:PedidoCompraItem(ordem, descricao, unidade))"
    )
    .eq("pedidoCompraId", pedido.id)
    .order("recebidoEm", { ascending: false });
  const recebimentos = (recebimentosBrutos ?? []).map((r) => ({
    ...r,
    registradoPor: r.registradoPor?.nome ?? null,
    itens: [...r.itens]
      .sort((a, b) => (a.item?.ordem ?? 0) - (b.item?.ordem ?? 0))
      .map((i) => ({
        descricao: i.item?.descricao ?? "Item",
        unidade: i.item?.unidade ?? "",
        recebida: Number(i.quantidadeRecebida),
        devolvida: Number(i.quantidadeDevolvida),
      })),
  }));
  const compraConfirmada = Boolean(pedido.compraConfirmadaEm);

  // Mesma regra da action: recebedor, comprador, admin ou o próprio requisitante.
  // Só depois de a compra ser confirmada, e enquanto o pedido não foi encerrado.
  const podeReceber =
    compraConfirmada &&
    (pedido.statusEntrega === "pendente" || pedido.statusEntrega === "recebido_parcial") &&
    (contexto.tem("recebedor", "comprador") || pedido.requisicao.requisitanteId === contexto.usuarioId);
  const podeConfirmar = !compraConfirmada && contexto.tem("comprador");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">{pedido.codigo}</h2>
            <BadgeStatusEntrega status={pedido.statusEntrega} compraConfirmada={compraConfirmada} />
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {contexto.veAba("pedidos") && (
              <Link href="/suprimentos/pedidos" className="hover:underline">
                ← Pedidos
              </Link>
            )}
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

      {podeConfirmar && <ConfirmarCompra pedidoId={pedido.id} />}
      {compraConfirmada && pedido.compraConfirmadaEm && (
        <p className="text-xs text-muted-foreground">
          Compra confirmada no fornecedor em {formatarDataHora(pedido.compraConfirmadaEm)}.
        </p>
      )}
      {!compraConfirmada && !podeConfirmar && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Aguardando o comprador confirmar a compra no fornecedor. Depois disso o recebimento fica liberado.
        </p>
      )}

      {/* No celular o formulário vem antes do documento: é o que a obra veio fazer. */}
      {podeReceber && (
        <RegistrarRecebimento
          pedidoId={pedido.id}
          nomeUsuario={contexto.nome}
          itens={pedido.itens.map((i) => ({
            id: i.id,
            ordem: i.ordem,
            descricao: i.descricao,
            unidade: i.unidade,
            quantidade: i.quantidade,
            recebida: i.quantidadeRecebida,
          }))}
        />
      )}

      <HistoricoRecebimentos recebimentos={recebimentos} />

      <div className="rounded-md border bg-white p-4 sm:p-6">
        <DocumentoPedido pedido={pedido} />
      </div>
    </div>
  );
}
