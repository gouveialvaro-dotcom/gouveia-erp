"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Abre o diálogo de impressão automaticamente ao entrar na página — é por ele
// que o usuário salva a proposta em PDF ("Destino: Salvar como PDF").
export function BarraImpressao({ voltarHref }: { voltarHref: string }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="sem-impressao flex items-center justify-between gap-4 border-b bg-muted/40 px-6 py-3">
      <Link href={voltarHref} className="text-sm text-muted-foreground hover:underline">
        ← Voltar ao orçamento
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
