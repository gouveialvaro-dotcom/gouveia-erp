"use client";

import { useState } from "react";
import { ORDEM_COLUNA_KANBAN, ROTULO_COLUNA, type ColunaKanban } from "@/lib/pos-venda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardChamado, type ChamadoCard } from "@/components/pos-venda/card-chamado";

export type ItemQuadro = {
  card: ChamadoCard;
  coluna: ColunaKanban;
  recorrente: boolean;
  novidade: boolean;
  parado: boolean;
  diasParado: number;
};

export function QuadroChamados({
  itens,
  hoje,
  podeEditar,
  meuId,
}: {
  itens: ItemQuadro[];
  hoje: string;
  podeEditar: boolean;
  /** Id conferido no banco (ver usuarioIdAtual) — é com ele que o dono do card
   *  é comparado. */
  meuId: string;
}) {
  // Recorte de leitura, não preferência: fica no cliente e não é persistido de
  // propósito. Guardar a escolha faria alguém voltar dias depois a um quadro
  // filtrado sem lembrar por quê, e concluir que o pós-venda esvaziou.
  const [somenteMeus, setSomenteMeus] = useState(false);

  const meus = itens.filter((i) => i.card.responsavelId === meuId).length;
  const visiveis = somenteMeus
    ? itens.filter((i) => i.card.responsavelId === meuId)
    : itens;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={somenteMeus ? "default" : "outline"}
          aria-pressed={somenteMeus}
          onClick={() => setSomenteMeus((atual) => !atual)}
        >
          Meus chamados ({meus})
        </Button>
        {somenteMeus && (
          <span className="text-xs text-muted-foreground">
            Mostrando só o que está no seu nome.
          </span>
        )}
      </div>

      {/* Empilhado no estreito e em faixa rolável a partir do desktop: com as
          seis colunas sempre lado a lado, a página inteira ficava mais larga que
          a tela e só cabia recolhendo a barra lateral. O overflow agora é da
          faixa, não do documento. */}
      <div className="flex flex-col gap-4 xl:flex-row xl:overflow-x-auto xl:pb-2">
        {ORDEM_COLUNA_KANBAN.map((coluna: ColunaKanban) => {
          const daColuna = visiveis.filter((i) => i.coluna === coluna);
          return (
            <div
              key={coluna}
              className="flex w-full min-w-0 flex-col gap-3 xl:w-60 xl:shrink-0"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{ROTULO_COLUNA[coluna]}</h2>
                <Badge
                  variant={
                    coluna === "vencido" && daColuna.length > 0 ? "destructive" : "outline"
                  }
                >
                  {daColuna.length}
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                {daColuna.map((item) => (
                  <CardChamado
                    key={item.card.id}
                    chamado={item.card}
                    coluna={coluna}
                    hoje={hoje}
                    recorrente={item.recorrente}
                    novidade={item.novidade}
                    parado={item.parado}
                    diasParado={item.diasParado}
                    podeEditar={podeEditar}
                  />
                ))}
                {daColuna.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-4 text-center">
                    Nenhum chamado
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
