"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ROTULO_TIPO_CONVERSA, type TipoConversa } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type ItemConversa = {
  id: string;
  tipo: TipoConversa;
  titulo: string;
  previa: string;
  naoLidas: number;
};

export function ListaConversas({ conversas }: { conversas: ItemConversa[] }) {
  // A lista mora no layout e não recebe params da rota; o destaque da conversa
  // aberta sai do próprio pathname.
  const pathname = usePathname();
  const ativaId = pathname?.split("/")[2];

  if (conversas.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Nenhuma conversa ainda. Comece uma pelo botão acima, ou abra o chat de uma obra.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {conversas.map((c) => (
        <li key={c.id}>
          <Link
            href={`/chat/${c.id}`}
            className={cn(
              "flex flex-col gap-0.5 border-b px-4 py-3 hover:bg-muted/50",
              c.id === ativaId && "bg-muted"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{c.titulo}</span>
              {c.naoLidas > 0 && <Badge>{c.naoLidas}</Badge>}
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {ROTULO_TIPO_CONVERSA[c.tipo]} · {c.previa}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
