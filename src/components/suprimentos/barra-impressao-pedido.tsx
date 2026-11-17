"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Mesmo comportamento da barra de impressão das propostas: abre o diálogo de
// impressão ao entrar, que é por onde se salva em PDF para mandar ao fornecedor.
export function BarraImpressaoPedido({ voltarHref }: { voltarHref: string }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="sem-impressao flex items-center justify-between gap-4 border-b bg-muted/40 px-6 py-3">
      <Link href={voltarHref} className="text-sm text-muted-foreground hover:underline">
        ← Voltar ao pedido
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          No diálogo de impressão, escolha <strong>Salvar como PDF</strong>.
        </span>
        <Button onClick={() => window.print()}>Imprimir / Salvar PDF</Button>
      </div>
    </div>
  );
}
