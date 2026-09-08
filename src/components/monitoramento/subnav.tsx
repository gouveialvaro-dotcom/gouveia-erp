"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { podeEscrever, type Perfil } from "@/lib/permissoes";

const ITENS = [
  { titulo: "Painel", href: "/monitoramento", somenteAdmin: false },
  // Usina que saiu do monitoramento não some: o histórico de geração e de falha
  // é argumento na renovação do contrato.
  { titulo: "Inativas", href: "/monitoramento/inativas", somenteAdmin: false },
  // Mora DENTRO do módulo, e não em /administracao, para quem cadastra não ser
  // jogado para fora do monitoramento a cada vínculo — perdendo a sub-navegação
  // e vendo a sidebar acender outro módulo. A exigência de permissão não mudou:
  // continua sendo escrita em "administracao", conferida na página e em cada
  // Server Action.
  { titulo: "Cadastro de usinas", href: "/monitoramento/cadastro", somenteAdmin: true },
];

/** Rotas filhas com nome próprio — tudo que não é uma delas é detalhe de usina. */
const FILHAS_FIXAS = ITENS.filter((i) => i.href !== "/monitoramento").map((i) => i.href);

export function MonitoramentoSubnav({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname() ?? "";
  const ehAdmin = podeEscrever(perfil, "administracao");
  const itens = ITENS.filter((item) => !item.somenteAdmin || ehAdmin);

  // O detalhe da usina ("/monitoramento/<id>") acende o Painel, que é de onde se
  // chega nele. A conta exclui as filhas fixas porque rota estática ganha do
  // segmento dinâmico no Next — sem isso, "Cadastro de usinas" acenderia o
  // Painel junto, e dois itens ficariam ativos ao mesmo tempo.
  const naRotaDeDetalhe =
    /^\/monitoramento\/[^/]+$/.test(pathname) && !FILHAS_FIXAS.includes(pathname);

  return (
    <nav className="mt-3 flex gap-1 border-b">
      {itens.map((item) => {
        const ativo =
          item.href === "/monitoramento"
            ? pathname === "/monitoramento" || naRotaDeDetalhe
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
              ativo
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.titulo}
          </Link>
        );
      })}
    </nav>
  );
}
