"use client";

import { useEffect } from "react";

/**
 * Rola a conversa até a mensagem que a busca encontrou e a destaca por alguns
 * segundos.
 *
 * Sem isto, clicar num resultado de meses atrás abriria a conversa no fim e o
 * atendente teria de caçar a mensagem rolando para cima — que é exatamente o
 * trabalho que a busca existe para evitar.
 */
export function AncoraMensagem({ mensagemId }: { mensagemId: string }) {
  useEffect(() => {
    const alvo = document.getElementById(`mensagem-${mensagemId}`);
    if (!alvo) return;

    alvo.scrollIntoView({ block: "center" });
    alvo.classList.add("ring-2", "ring-primary");

    // O destaque é temporário: permanente, ele viraria ruído na próxima vez
    // que a pessoa abrisse a mesma conversa por outro caminho.
    const timer = setTimeout(() => {
      alvo.classList.remove("ring-2", "ring-primary");
    }, 4000);

    return () => clearTimeout(timer);
  }, [mensagemId]);

  return null;
}
