"use client";

import { useState, type ReactNode } from "react";
import {
  ORDEM_COLUNA_KANBAN,
  ROTULO_COLUNA,
  type ColunaKanban,
  type EstadoCard,
} from "@/lib/pos-venda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardChamado, type ChamadoCard } from "@/components/pos-venda/card-chamado";
import {
  BarraFiltros,
  type FiltrosPosVenda,
  type Opcao,
} from "@/components/pos-venda/filtros";

// Teto inicial por coluna. Uma coluna cheia empurrava as demais para fora da
// tela e obrigava a rolar a página inteira para conferir a próxima etapa; com o
// teto, as seis etapas voltam a ser comparáveis de um olhar só. O resto não
// some — fica atrás do "Ver mais" da própria coluna.
const CARDS_POR_COLUNA = 5;

export type ItemQuadro = {
  card: ChamadoCard;
  coluna: ColunaKanban;
  estado: EstadoCard;
  inatividade: string | null;
  foraDoPrazo: boolean;
  recorrente: boolean;
  novidade: boolean;
};

export function QuadroChamados({
  itens,
  hoje,
  podeEditar,
  meuId,
  cabecalho,
  filtros,
  clientes,
  tipos,
  responsaveis,
  acaoNovoChamado,
}: {
  itens: ItemQuadro[];
  hoje: string;
  podeEditar: boolean;
  /** Id conferido no banco (ver usuarioIdAtual) — é com ele que o dono do card
   *  é comparado. */
  meuId: string;
  /** Título e indicadores da página. Vêm para dentro do quadro, e não ficam
   *  soltos na página, porque o bloco que gruda no topo precisa ser um
   *  elemento só. */
  cabecalho?: ReactNode;
  /* A barra de filtros é montada aqui, e não na página, porque o botão "Meus
     chamados" divide a linha com o "Filtrar" e é estado deste componente —
     recorte resolvido na hora, sem ida ao servidor. Por isso os dados dos
     campos precisam descer até aqui. */
  filtros: FiltrosPosVenda;
  clientes: Opcao[];
  tipos: Opcao[];
  responsaveis: Opcao[];
  /** "+ Novo chamado", montado na página porque depende de permissão. Entra na
   *  mesma linha para não gastar uma faixa de tela só para ele. */
  acaoNovoChamado?: ReactNode;
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
      {/* Indicadores e filtros ficam à vista enquanto o quadro rola.
          Só a partir de xl, que é onde os cinco indicadores cabem em uma linha
          e o bloco fica entre 250px e 300px; abaixo disso eles quebram em duas
          ou três linhas (416px em 1100px de largura, 758px em 820px) e congelar
          tomaria a tela que o quadro precisa. Amarrar na mesma medida de
          xl:grid-cols-5 é o que garante que a barra fixa só apareça onde cabe.
          A margem negativa cancela o padding do <main> para o fundo encostar no
          topo da tela e tapar os cards que passam por baixo; a borda deixa esse
          corte proposital em vez de parecer card cortado no meio. */}
      <div className="z-20 flex flex-col gap-4 bg-background -mt-4 pt-4 pb-3 sm:-mt-6 sm:pt-6 xl:sticky xl:top-0 xl:border-b">
        {cabecalho}

        <BarraFiltros
          filtros={filtros}
          clientes={clientes}
          tipos={tipos}
          responsaveis={responsaveis}
          acoes={
            <>
              <Button
                type="button"
                variant={somenteMeus ? "default" : "outline"}
                aria-pressed={somenteMeus}
                onClick={() => setSomenteMeus((atual) => !atual)}
              >
                Meus chamados ({meus})
              </Button>
              {acaoNovoChamado}
            </>
          }
        />
      </div>

      {/* Empilhado no estreito e em faixa rolável a partir do desktop: com as
          seis colunas sempre lado a lado, a página inteira ficava mais larga que
          a tela e só cabia recolhendo a barra lateral. O overflow agora é da
          faixa, não do documento. */}
      <div className="flex flex-col gap-4 xl:flex-row xl:overflow-x-auto xl:pb-2">
        {ORDEM_COLUNA_KANBAN.map((coluna: ColunaKanban) => (
          <ColunaQuadro
            key={coluna}
            coluna={coluna}
            itens={visiveis.filter((i) => i.coluna === coluna)}
            hoje={hoje}
            podeEditar={podeEditar}
          />
        ))}
      </div>
    </div>
  );
}

function ColunaQuadro({
  coluna,
  itens,
  hoje,
  podeEditar,
}: {
  coluna: ColunaKanban;
  itens: ItemQuadro[];
  hoje: string;
  podeEditar: boolean;
}) {
  // Aberta ou fechada é decisão de cada coluna: quem quer ver o fundo de
  // "Vencido" não precisa desdobrar "Concluído" junto.
  const [aberta, setAberta] = useState(false);

  const ocultos = Math.max(0, itens.length - CARDS_POR_COLUNA);
  const visiveis = aberta ? itens : itens.slice(0, CARDS_POR_COLUNA);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 xl:w-60 xl:shrink-0">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{ROTULO_COLUNA[coluna]}</h2>
        {/* O contador segue mostrando o total da etapa, não o que está à
            mostra: é ele que responde "quantos estão vencidos?". */}
        <Badge
          variant={coluna === "vencido" && itens.length > 0 ? "destructive" : "outline"}
        >
          {itens.length}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        {visiveis.map((item) => (
          <CardChamado
            key={item.card.id}
            chamado={item.card}
            coluna={coluna}
            hoje={hoje}
            estado={item.estado}
            inatividade={item.inatividade}
            foraDoPrazo={item.foraDoPrazo}
            recorrente={item.recorrente}
            novidade={item.novidade}
            podeEditar={podeEditar}
          />
        ))}

        {ocultos > 0 && (
          // "Ver menos" existe para o caminho de volta: sem ele, abrir uma
          // coluna cheia seria irreversível sem recarregar a página.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            aria-expanded={aberta}
            onClick={() => setAberta((atual) => !atual)}
          >
            {aberta ? "Ver menos" : `Ver mais (${ocultos})`}
          </Button>
        )}

        {itens.length === 0 && (
          <p className="text-xs text-muted-foreground px-1 py-4 text-center">
            Nenhum chamado
          </p>
        )}
      </div>
    </div>
  );
}
