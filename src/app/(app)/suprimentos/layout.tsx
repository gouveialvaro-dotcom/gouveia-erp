import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { SuprimentosSubnav, type ItemSubnavSuprimentos } from "@/components/suprimentos/subnav";
import { TituloPagina } from "@/components/titulo-pagina";

export default async function SuprimentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ehAdmin, tem } = await contextoSuprimentos();

  const itens: ItemSubnavSuprimentos[] = [
    { titulo: "Início", href: "/suprimentos" },
    { titulo: "Requisições", href: "/suprimentos/requisicoes" },
    ...(tem("aprovador_gerencia", "aprovador_diretoria")
      ? [{ titulo: "Aprovações", href: "/suprimentos/aprovacoes" }]
      : []),
    { titulo: "Pedidos", href: "/suprimentos/pedidos" },
    { titulo: "Produtos", href: "/suprimentos/produtos" },
    { titulo: "Fornecedores", href: "/suprimentos/fornecedores" },
  ];
  if (ehAdmin) {
    itens.push({ titulo: "Empresas", href: "/suprimentos/empresas" });
    itens.push({ titulo: "Configuração", href: "/suprimentos/configuracao" });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Quem publica o título é o layout, como em Monitoramento: duas
          publicações na mesma rota disputariam o slot da Topbar. */}
      <TituloPagina titulo="Suprimentos" />
      <SuprimentosSubnav itens={itens} />
      {children}
    </div>
  );
}
