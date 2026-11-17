import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import { papeisDoUsuario } from "@/lib/suprimentos-auth";
import { carregarPedido } from "@/lib/suprimentos-pedidos";
import { DocumentoPedido } from "@/components/suprimentos/documento-pedido";
import { BarraImpressaoPedido } from "@/components/suprimentos/barra-impressao-pedido";

// Fora do grupo (app) de propósito, como /propostas/[id]: o pedido é impresso
// sem a sidebar e sem a topbar do sistema.
export default async function PaginaImprimirPedido({ params }: { params: Promise<{ id: string }> }) {
  const { userId, perfil } = await sessaoAtual();
  if (!podeLer(perfil, "suprimentos")) notFound();

  const { id } = await params;
  const pedido = await carregarPedido(id);
  if (!pedido) notFound();
  const papeis = await papeisDoUsuario(userId);
  if (perfil !== "admin" && papeis.size === 0 && pedido.requisicao.requisitanteId !== userId) notFound();

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <style>{`
        @media print {
          .sem-impressao { display: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
      <BarraImpressaoPedido voltarHref={`/suprimentos/pedidos/${pedido.id}`} />
      <div className="mx-auto max-w-4xl p-6 print:p-0">
        <DocumentoPedido pedido={pedido} />
      </div>
    </div>
  );
}
