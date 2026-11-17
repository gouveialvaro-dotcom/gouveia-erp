"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { tempoRelativo } from "@/lib/pos-venda";
import { ROTULO_AVISO, type AvisoSuprimentosItem } from "@/lib/suprimentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Sino do Suprimentos, ao lado do sino do pós-venda. Mesmo comportamento: busca
// a cada minuto e ao voltar para a aba; falha de rede não derruba a barra.

const INTERVALO_MS = 60_000;

const DESTACADO = new Set(["nova_requisicao", "aprovacao_pendente", "requisicao_recusada"]);

export function SinoSuprimentos() {
  const router = useRouter();
  const [itens, setItens] = useState<AvisoSuprimentosItem[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const painel = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/suprimentos/notificacoes", { cache: "no-store" });
      if (!resposta.ok) return;
      const dados = await resposta.json();
      setItens(dados.itens);
      setNaoLidas(dados.naoLidas);
    } catch {
      // Acessório: sem rede, o sino só não atualiza.
    }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(carregar, 0);
    const timer = setInterval(carregar, INTERVALO_MS);
    const aoFocar = () => carregar();
    window.addEventListener("focus", aoFocar);
    return () => {
      clearTimeout(primeira);
      clearInterval(timer);
      window.removeEventListener("focus", aoFocar);
    };
  }, [carregar]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!painel.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  async function marcar(corpo: Record<string, unknown>) {
    await fetch("/api/suprimentos/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    await carregar();
  }

  async function abrir(item: AvisoSuprimentosItem) {
    setAberto(false);
    if (!item.lida) await marcar({ id: item.id });
    if (item.pedidoCompraId) router.push(`/suprimentos/pedidos/${item.pedidoCompraId}`);
    else if (item.requisicaoId) router.push(`/suprimentos/requisicoes/${item.requisicaoId}`);
  }

  return (
    <div className="relative" ref={painel}>
      <Button
        variant="ghost"
        size="icon"
        title="Avisos de Suprimentos"
        aria-label={`Avisos de Suprimentos${naoLidas > 0 ? ` (${naoLidas} não lidos)` : ""}`}
        onClick={() => setAberto((v) => !v)}
      >
        <ShoppingCart className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      {aberto && (
        <div className="absolute right-0 top-10 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Suprimentos</span>
            {naoLidas > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => marcar({ todas: true })}
              >
                Marcar todos como lidos
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {itens.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => abrir(item)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted",
                  !item.lida && "bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={DESTACADO.has(item.tipo) ? "default" : "outline"}>
                    {ROTULO_AVISO[item.tipo] ?? item.tipo}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{tempoRelativo(item.criadoEm)}</span>
                </div>
                <span className={cn("text-sm", !item.lida && "font-medium")}>{item.titulo}</span>
                {item.detalhe && (
                  <span className="text-xs text-muted-foreground line-clamp-2">{item.detalhe}</span>
                )}
                {item.autor && <span className="text-xs text-muted-foreground">por {item.autor}</span>}
              </button>
            ))}
            {itens.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum aviso.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
