"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVALO_MS = 8_000;

/**
 * Mantém a conversa em dia sem WebSocket: pede ao Next para refazer o Server
 * Component, que relê o banco.
 *
 * O projeto não usa Supabase Realtime — ele exigiria a anon key no browser e
 * policies de RLS, e as tabelas foram criadas de propósito com RLS ligada e
 * nenhuma policy (ver src/lib/supabase.ts). O sino de notificações já resolve o
 * mesmo problema com polling; aqui o intervalo é bem menor porque é uma
 * conversa: um minuto de atraso numa mensagem de cliente seria sentido.
 */
export function AtualizacaoAutomatica() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), INTERVALO_MS);
    // Voltar para a aba é quando a pessoa quer ver o que chegou — sem isso ela
    // esperaria o próximo tique olhando uma tela vencida.
    const aoFocar = () => router.refresh();
    window.addEventListener("focus", aoFocar);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", aoFocar);
    };
  }, [router]);

  return null;
}
