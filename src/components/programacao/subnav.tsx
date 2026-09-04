"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { podeEscrever, type Perfil } from "@/lib/permissoes";

const ITENS = [
  { titulo: "Programação", href: "/programacao", somenteEscrita: false },
  {
    titulo: "Indisponibilidades",
    href: "/programacao/indisponibilidades",
    somenteEscrita: false,
  },
  // O histórico de envios é ferramenta de quem publica: quem só lê a
  // programação não tem o que fazer com um botão de reenvio.
  { titulo: "Envios", href: "/programacao/envios", somenteEscrita: true },
];

export function ProgramacaoSubnav({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();
  const podeEditar = podeEscrever(perfil, "programacao");
  const itens = ITENS.filter((item) => !item.somenteEscrita || podeEditar);

  return (
    <nav className="mt-3 flex gap-1 border-b">
      {itens.map((item) => {
        // Só o item mais específico acende: "/programacao" é prefixo dos outros.
        const ativo =
          item.href === "/programacao"
            ? pathname === "/programacao"
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
