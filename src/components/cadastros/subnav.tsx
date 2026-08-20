"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { podeLer, type Modulo, type Perfil } from "@/lib/permissoes";

const ITENS: { titulo: string; href: string; modulo: Modulo }[] = [
  // Cada ramo tem seu próprio cadastro: energia solar tem unidades e contrato
  // de manutenção; redes/subestações é só o cadastro de contato.
  { titulo: "Clientes · Energia solar", href: "/cadastros/clientes/solar", modulo: "clientes" },
  { titulo: "Clientes · Redes/Subestações", href: "/cadastros/clientes/redes", modulo: "clientes" },
  { titulo: "Materiais", href: "/cadastros/materiais", modulo: "cadastrosGerais" },
  { titulo: "Kits", href: "/cadastros/kits", modulo: "cadastrosGerais" },
  { titulo: "Funcionários", href: "/cadastros/funcionarios", modulo: "cadastrosGerais" },
  { titulo: "Concessionárias", href: "/cadastros/concessionarias", modulo: "posVenda" },
  { titulo: "Tipos de problema", href: "/cadastros/tipos-problema", modulo: "posVenda" },
  { titulo: "Descrições padrão", href: "/cadastros/descricoes", modulo: "cadastrosGerais" },
  { titulo: "Parâmetros gerais", href: "/cadastros/parametros", modulo: "cadastrosGerais" },
];

export function CadastrosSubnav({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();
  const itens = ITENS.filter((item) => podeLer(perfil, item.modulo));

  return (
    <nav className="mt-3 flex gap-1 border-b">
      {itens.map((item) => {
        const ativo = pathname?.startsWith(item.href);
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
