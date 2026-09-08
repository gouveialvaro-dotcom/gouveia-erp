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
  // O vínculo com cliente e UC geradora é o que faz o alerta chegar em alguém.
  // Por isso mora em /administracao e exige escrita LÁ, não aqui.
  { titulo: "Cadastro de usinas", href: "/administracao/monitoramento", somenteAdmin: true },
];

export function MonitoramentoSubnav({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();
  const ehAdmin = podeEscrever(perfil, "administracao");
  const itens = ITENS.filter((item) => !item.somenteAdmin || ehAdmin);

  return (
    <nav className="mt-3 flex gap-1 border-b">
      {itens.map((item) => {
        // Só o item mais específico acende: "/monitoramento" é prefixo dos
        // outros. O detalhe da usina ("/monitoramento/<id>") acende o Painel,
        // que é de onde se chega nele — mas "inativas" é rota estática e ganha
        // do segmento dinâmico, então precisa sair dessa conta.
        const naRotaDeDetalhe =
          /^\/monitoramento\/[^/]+$/.test(pathname ?? "") &&
          pathname !== "/monitoramento/inativas";
        const ativo =
          item.href === "/monitoramento"
            ? pathname === "/monitoramento" || naRotaDeDetalhe
            : pathname?.startsWith(item.href);
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
