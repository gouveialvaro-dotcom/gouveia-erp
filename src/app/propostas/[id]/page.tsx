import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import { carregarDadosProposta } from "@/lib/proposta";
import { construirHtmlProposta } from "@/lib/proposta-html";
import { BarraImpressao } from "@/components/propostas/barra-impressao";

// Fora do grupo (app) de propósito: a proposta é impressa sem a sidebar e sem a
// topbar do sistema.
export default async function PaginaImprimirProposta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await sessaoAtual();
  if (!podeLer(perfil, "orcamentos")) notFound();

  const { id } = await params;
  const dados = await carregarDadosProposta(id);
  if (!dados) notFound();

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <style>{`
        @media print {
          .sem-impressao { display: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <BarraImpressao voltarHref={`/orcamentos/${dados.orcamento.id}`} />
      {/* Mesma marcação servida no arquivo Word — ver src/lib/proposta-html.ts. */}
      <div dangerouslySetInnerHTML={{ __html: construirHtmlProposta(dados) }} />
    </div>
  );
}
