"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ROTULO_NOTIFICACAO,
  tempoRelativo,
  type NotificacaoItem,
} from "@/lib/pos-venda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const INTERVALO_MS = 60_000;

export function SinoNotificacoes() {
  const router = useRouter();
  const [itens, setItens] = useState<NotificacaoItem[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const painel = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/pos-venda/notificacoes", { cache: "no-store" });
      if (!resposta.ok) return;
      const dados = await resposta.json();
      setItens(dados.itens);
      setNaoLidas(dados.naoLidas);
    } catch {
      // Sino é acessório: falha de rede não pode derrubar a barra superior.
    }
  }, []);

  useEffect(() => {
    // A primeira busca também é agendada, e não chamada direto no corpo do
    // efeito: assim todo setState nasce de um callback do timer, e não de uma
    // renderização em cascata.
    const primeira = setTimeout(carregar, 0);
    const timer = setInterval(carregar, INTERVALO_MS);
    // Voltar para a aba costuma ser o momento em que a pessoa quer o número
    // certo — sem isso ela esperaria até um minuto por um dado já vencido.
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
    await fetch("/api/pos-venda/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    await carregar();
  }

  async function abrirChamado(item: NotificacaoItem) {
    setAberto(false);
    if (!item.lida) await marcar({ id: item.id });
    // Sem router.refresh() depois do push: recarregar a rota atual concorre
    // com a navegação e o usuário fica onde estava. A tela de destino já é
    // renderizada nova no servidor.
    router.push(`/pos-venda/${item.chamadoId}`);
  }

  return (
    <div className="relative" ref={painel}>
      <Button
        variant="ghost"
        size="icon"
        title="Notificações do pós-venda"
        aria-label={`Notificações do pós-venda${naoLidas > 0 ? ` (${naoLidas} não lidas)` : ""}`}
        onClick={() => setAberto((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      {aberto && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Pós-venda</span>
            {naoLidas > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => marcar({ todas: true })}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {itens.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => abrirChamado(item)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted",
                  !item.lida && "bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={item.tipo === "chamado_vencido" ? "destructive" : "outline"}
                  >
                    {ROTULO_NOTIFICACAO[item.tipo]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {tempoRelativo(item.criadoEm)}
                  </span>
                </div>
                <span className={cn("text-sm", !item.lida && "font-medium")}>
                  {item.titulo}
                </span>
                {item.detalhe && (
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {item.detalhe}
                  </span>
                )}
                {item.autor && (
                  <span className="text-xs text-muted-foreground">por {item.autor}</span>
                )}
              </button>
            ))}
            {itens.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
