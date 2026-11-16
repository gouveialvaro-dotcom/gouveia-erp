"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ItemSubnavSuprimentos = { titulo: string; href: string };

// Os itens chegam prontos do layout (Server Component), que decide pelos papéis
// do usuário quais abas aparecem. Esconder a aba nunca é a garantia: cada
// página e cada action confere o papel de novo.
export function SuprimentosSubnav({ itens }: { itens: ItemSubnavSuprimentos[] }) {
  const pathname = usePathname() ?? "";

  // A aba mais específica que casa com a rota é a ativa — "/suprimentos" só
  // acende quando nenhuma outra aba casa (detalhe de requisição, por exemplo).
  const ativa = itens
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="mt-3 flex gap-1 overflow-x-auto border-b">
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "shrink-0 px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
            item.href === ativa?.href
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {item.titulo}
        </Link>
      ))}
    </nav>
  );
}
