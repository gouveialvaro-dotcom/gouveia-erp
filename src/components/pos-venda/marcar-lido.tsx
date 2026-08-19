"use client";

import { useEffect } from "react";

// Abrir o chamado é o gesto que "lê" as notificações dele. Fica num efeito de
// cliente, e não no render do Server Component, para não gravar durante a
// renderização da página.
export function MarcarLido({ chamadoId }: { chamadoId: string }) {
  useEffect(() => {
    fetch("/api/pos-venda/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chamadoId }),
    }).catch(() => {});
  }, [chamadoId]);

  return null;
}
