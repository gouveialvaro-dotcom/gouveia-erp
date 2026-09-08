"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarData } from "@/lib/format";
import {
  CORES_ESTADO_CARD,
  ROTULO_ESTADO_CARD,
  COLUNAS_DERIVADAS,
  ORDEM_ESTAGIO_FLUXO,
  ROTULO_ESTAGIO,
  ROTULO_PRIORIDADE,
  textoPrazo,
  type ColunaKanban,
  type EstadoCard,
  type EstagioChamado,
  type PrioridadeChamado,
} from "@/lib/pos-venda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { avancarEstagio, voltarEstagio } from "@/app/(app)/pos-venda/actions";

export type ChamadoCard = {
  id: string;
  numero: number;
  /** Usado pelo filtro "Meus chamados" do quadro. */
  responsavelId: string;
  titulo: string;
  estagio: EstagioChamado;
  prioridade: PrioridadeChamado;
  prazoLimite: string;
  concluidoEm: string | null;
  cliente: string;
  tipo: string;
  responsavel: string;
  unidade: string | null;
  concessionaria: string | null;
};

export function CardChamado({
  chamado,
  coluna,
  hoje,
  estado,
  inatividade,
  foraDoPrazo,
  recorrente,
  novidade,
  podeEditar,
}: {
  chamado: ChamadoCard;
  coluna: ColunaKanban;
  hoje: string;
  /** Cor e palavra do card — regra e ordem de prioridade em lib/pos-venda.ts. */
  estado: EstadoCard;
  /** Texto pronto da etiqueta de inatividade, ou null quando não cabe. */
  inatividade: string | null;
  /** Concluído depois do prazo: o verde escuro vence o vermelho, então o atraso
   *  só continua visível por esta etiqueta. */
  foraDoPrazo: boolean;
  recorrente: boolean;
  /** Alguém mexeu no chamado e este usuário ainda não abriu para ver. */
  novidade: boolean;
  podeEditar: boolean;
}) {
  const vencido = coluna === "vencido";
  const aVencer = coluna === "a_vencer";
  const concluido = coluna === "concluido";
  const cores = CORES_ESTADO_CARD[estado];
  const prioridade = ROTULO_PRIORIDADE[chamado.prioridade];
  const indiceFluxo = ORDEM_ESTAGIO_FLUXO.indexOf(
    chamado.estagio as (typeof ORDEM_ESTAGIO_FLUXO)[number]
  );

  return (
    // A cor vive só na faixa da borda esquerda: pintar o fundo do card deixa o
    // quadro inteiro colorido, o que vira poluição e some no tema escuro.
    <Card size="sm" className={cn("border-l-4", cores.faixa)}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            #{chamado.numero}
            {/* A palavra é obrigatória, não é reforço: cor sozinha não pode ser
                a única fonte da informação — parte da equipe não distingue bem
                verde de laranja de vermelho. */}
            <Badge variant="outline" className={cn("gap-1", cores.etiqueta)}>
              {concluido && <Check className="size-3" />}
              {ROTULO_ESTADO_CARD[estado]}
            </Badge>
            {novidade && (
              <span
                className="inline-block size-2 shrink-0 rounded-full bg-primary"
                title="Atualizado desde a sua última visita"
              />
            )}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {novidade && <Badge variant="secondary">Atualizado</Badge>}
            {recorrente && (
              <Badge variant="destructive" title="3+ chamados do mesmo tipo em 6 meses">
                Recorrente
              </Badge>
            )}
            <Badge variant={prioridade.variant}>{prioridade.texto}</Badge>
          </div>
        </div>

        {(inatividade || foraDoPrazo) && (
          // Convivem com qualquer cor: um card pode estar verde E parado há
          // seis dias. Por isso ficam fora do bloco de estado, não dentro dele.
          <div className="flex flex-wrap gap-1">
            {inatividade && (
              <Badge variant="secondary" className="font-normal">
                {inatividade}
              </Badge>
            )}
            {foraDoPrazo && (
              <Badge
                variant="outline"
                className="font-normal"
                title="Encerrado depois do prazo limite"
              >
                Fora do prazo
              </Badge>
            )}
          </div>
        )}

        <Link href={`/pos-venda/${chamado.id}`} className="font-medium hover:underline">
          {chamado.cliente}
        </Link>
        <p className="text-xs line-clamp-2">{chamado.titulo}</p>

        <p className="text-xs text-muted-foreground">
          {chamado.unidade ? `UC ${chamado.unidade}` : "Sem UC vinculada"}
          {chamado.concessionaria && ` · ${chamado.concessionaria}`}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">{chamado.tipo}</p>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground line-clamp-1" title="Responsável">
            {chamado.responsavel}
          </span>
          {concluido ? (
            <Badge variant="outline">
              {chamado.concluidoEm ? formatarData(chamado.concluidoEm) : "Concluído"}
            </Badge>
          ) : (
            <Badge variant={vencido ? "destructive" : aVencer ? "secondary" : "outline"}>
              {textoPrazo(chamado, hoje)}
            </Badge>
          )}
        </div>

        {/* Nas colunas derivadas do prazo o estágio de trabalho sai da vista —
            então ele volta aqui, para não perder onde o atendimento parou. */}
        {COLUNAS_DERIVADAS.includes(coluna) && (
          <Badge variant="outline" className="w-fit">
            {ROTULO_ESTAGIO[chamado.estagio]}
          </Badge>
        )}

        <p className="text-xs text-muted-foreground">
          Prazo: {formatarData(chamado.prazoLimite)}
        </p>

        {podeEditar && indiceFluxo >= 0 && (
          <div className="flex gap-1 pt-1">
            {indiceFluxo > 0 && (
              <form action={voltarEstagio.bind(null, chamado.id, chamado.estagio)}>
                <Button type="submit" variant="outline" size="xs">
                  ← Voltar
                </Button>
              </form>
            )}
            {indiceFluxo < ORDEM_ESTAGIO_FLUXO.length - 1 && (
              <form action={avancarEstagio.bind(null, chamado.id, chamado.estagio)}>
                <Button type="submit" variant="secondary" size="xs">
                  Avançar →
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
