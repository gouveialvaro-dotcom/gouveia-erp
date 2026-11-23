import { contextoSuprimentos, type AbaSuprimentos } from "@/lib/suprimentos-auth";
import { SuprimentosSubnav, type ItemSubnavSuprimentos } from "@/components/suprimentos/subnav";
import { TituloPagina } from "@/components/titulo-pagina";
import { exigirModuloVisivel } from "@/lib/modulos-visiveis";

export default async function SuprimentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirModuloVisivel("suprimentos");
  const { ehAdmin, veAba } = await contextoSuprimentos();

  // Cada um vê as abas do próprio papel (PAPEIS_DA_ABA); o admin vê todas.
  const todas: (ItemSubnavSuprimentos & { aba?: AbaSuprimentos })[] = [
    { titulo: "Início", href: "/suprimentos", aba: "inicio" },
    { titulo: "Requisições", href: "/suprimentos/requisicoes" },
    { titulo: "Aprovações", href: "/suprimentos/aprovacoes", aba: "aprovacoes" },
    { titulo: "Pedidos", href: "/suprimentos/pedidos", aba: "pedidos" },
    { titulo: "Recebimentos", href: "/suprimentos/recebimentos", aba: "recebimentos" },
    { titulo: "Produtos", href: "/suprimentos/produtos", aba: "produtos" },
    { titulo: "Fornecedores", href: "/suprimentos/fornecedores", aba: "fornecedores" },
  ];
  const itens: ItemSubnavSuprimentos[] = todas
    .filter((i) => !i.aba || veAba(i.aba))
    .map(({ titulo, href }) => ({ titulo, href }));
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
