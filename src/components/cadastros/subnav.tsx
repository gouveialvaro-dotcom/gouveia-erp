"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// As abas chegam já filtradas pelo layout (perfil + marcações da pessoa em
// Administração → Módulos; ver lib/modulos-menu.ts).
export function CadastrosSubnav({ abas }: { abas: { titulo: string; href: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-3 flex flex-wrap gap-1 border-b">
      {abas.map((item) => {
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
