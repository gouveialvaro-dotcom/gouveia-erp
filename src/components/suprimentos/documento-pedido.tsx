import { ROTULO_FRETE, codigoRequisicao, formatarCnpj } from "@/lib/suprimentos";
import { moeda, precoUnitarioBr } from "@/lib/suprimentos-cotacao";
import { formatarData, formatarDataHora } from "@/lib/format";
import type { PedidoCarregado } from "@/lib/suprimentos-pedidos";

// O pedido como o fornecedor recebe: quem compra (empresa faturada), quem
// vende, onde entregar, itens e condições. Usado no detalhe e na impressão —
// cores neutras para sair igual no papel.

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-neutral-300 p-3 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{titulo}</span>
      {children}
    </div>
  );
}

export function DocumentoPedido({ pedido }: { pedido: PedidoCarregado }) {
  const f = pedido.fornecedor;
  const e = pedido.empresa;
  const r = pedido.requisicao;
  const freteTexto =
    pedido.frete === "fob" && pedido.coletaPropria ? "FOB — coleta com veículo próprio" : ROTULO_FRETE[pedido.frete];
  // Na nota do fornecedor só entram os itens e o frete CIF.
  const freteNaNota = pedido.frete === "cif" ? pedido.valorFrete : 0;
  const valorNota = pedido.valorItens + freteNaNota;
  const custosFora = pedido.valorTotal - valorNota;

  return (
    <div className="flex flex-col gap-4 bg-white text-neutral-900">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-neutral-300 pb-3">
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Pedido de compra
          </span>
          <span className="font-mono text-2xl font-semibold">{pedido.codigo}</span>
        </div>
        <div className="text-right text-xs text-neutral-600">
          Emitido em {formatarDataHora(pedido.emitidoEm)}
          {pedido.emitidoPor?.nome && <span className="block">Comprador: {pedido.emitidoPor.nome}</span>}
          <span className="block">Requisição {codigoRequisicao(r.numero)}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        <Bloco titulo="Faturar para">
          {e ? (
            <>
              <span className="font-medium">{e.razaoSocial}</span>
              <span>CNPJ {formatarCnpj(e.cnpj)}</span>
            </>
          ) : (
            <span className="text-amber-700">Empresa de faturamento não definida para esta obra.</span>
          )}
        </Bloco>
        <Bloco titulo="Fornecedor">
          <span className="font-medium">{f?.razaoSocial ?? "—"}</span>
          {f?.cnpj && <span>CNPJ {formatarCnpj(f.cnpj)}</span>}
          <span>
            {[f?.cidade, f?.uf].filter(Boolean).join(" / ")}
            {pedido.cotacao?.vendedor ? ` · Vendedor: ${pedido.cotacao.vendedor}` : ""}
          </span>
          {(f?.telefone || f?.email) && (
            <span className="text-neutral-600">{[f?.telefone, f?.email].filter(Boolean).join(" · ")}</span>
          )}
        </Bloco>
        <Bloco titulo="Entrega">
          <span className="font-medium">Obra: {r.obra?.nomeProjeto ?? "—"}</span>
          {r.obra?.cliente?.razaoSocial && <span className="text-neutral-600">{r.obra.cliente.razaoSocial}</span>}
          <span>Solicitante: {r.requisitante?.nome ?? "—"}</span>
          {r.urgencia === "emergencial" && <span className="font-semibold text-red-700">URGENTE — emergencial</span>}
        </Bloco>
        <Bloco titulo="Condições">
          <span>Pagamento: {pedido.condicaoPagamento}</span>
          <span>Frete: {freteTexto}</span>
          <span>
            Prazo:{" "}
            {pedido.prazoEntregaDias === null
              ? "—"
              : pedido.prazoEntregaDias === 0
                ? "pronta entrega"
                : `${pedido.prazoEntregaDias} dia${pedido.prazoEntregaDias === 1 ? "" : "s"}`}
            {pedido.previsaoEntrega && ` (previsão ${formatarData(pedido.previsaoEntrega)})`}
          </span>
        </Bloco>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-400 text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-2 w-8">#</th>
            <th className="py-2 pr-2">Descrição</th>
            <th className="py-2 pr-2 text-right">Qtd.</th>
            <th className="py-2 pr-2">Un.</th>
            <th className="py-2 pr-2 text-right">Preço unit.</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((item, i) => (
            <tr key={item.id} className="border-b border-neutral-200 align-top">
              <td className="py-2 pr-2 text-neutral-500">{i + 1}</td>
              <td className="py-2 pr-2">
                {item.descricao}
                {item.especificacao && (
                  <span className="block whitespace-pre-line text-xs text-neutral-600">{item.especificacao}</span>
                )}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">{item.quantidade.toLocaleString("pt-BR")}</td>
              <td className="py-2 pr-2">{item.unidade}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{precoUnitarioBr(item.precoUnitario)}</td>
              <td className="py-2 text-right tabular-nums">{moeda(item.precoTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto flex w-full max-w-sm flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-600">Itens</span>
          <span className="tabular-nums">{moeda(pedido.valorItens)}</span>
        </div>
        {freteNaNota > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-600">Frete (CIF)</span>
            <span className="tabular-nums">{moeda(freteNaNota)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-neutral-400 pt-1 text-base font-semibold">
          <span>Total do pedido</span>
          <span className="tabular-nums">{moeda(valorNota)}</span>
        </div>
      </div>

      {/* Custos que não vão na nota do fornecedor (frete FOB pago à parte, DIFAL
          recolhido pela compradora). Entram na alçada, mas não saem impressos. */}
      {custosFora > 0.004 && (
        <div className="print:hidden ml-auto flex w-full max-w-sm flex-col gap-1 rounded-md border border-dashed border-neutral-300 p-2 text-xs text-neutral-600">
          <span className="font-medium">Custos da compradora, fora da nota (não saem na impressão)</span>
          {pedido.frete === "fob" && pedido.valorFrete > 0 && (
            <div className="flex justify-between">
              <span>Frete FOB / coleta</span>
              <span className="tabular-nums">{moeda(pedido.valorFrete)}</span>
            </div>
          )}
          {pedido.valorDifal > 0 && (
            <div className="flex justify-between">
              <span>DIFAL</span>
              <span className="tabular-nums">{moeda(pedido.valorDifal)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium text-neutral-800">
            <span>Custo total da compra (alçada)</span>
            <span className="tabular-nums">{moeda(pedido.valorTotal)}</span>
          </div>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Mencione o código {pedido.codigo} na nota fiscal. Entrega sujeita a conferência na obra.
      </p>
    </div>
  );
}
