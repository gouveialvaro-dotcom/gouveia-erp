import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatarData } from "@/lib/format";
import {
  COLUNAS_DERIVADAS,
  ORDEM_ESTAGIO_FLUXO,
  ROTULO_ESTAGIO,
  ROTULO_PRIORIDADE,
  textoPrazo,
  type ColunaKanban,
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
  recorrente,
  novidade,
  podeEditar,
}: {
  chamado: ChamadoCard;
  coluna: ColunaKanban;
  hoje: string;
  recorrente: boolean;
  /** Alguém mexeu no chamado e este usuário ainda não abriu para ver. */
  novidade: boolean;
  podeEditar: boolean;
}) {
  const vencido = coluna === "vencido";
  const aVencer = coluna === "a_vencer";
  const concluido = coluna === "concluido";
  const prioridade = ROTULO_PRIORIDADE[chamado.prioridade];
  const indiceFluxo = ORDEM_ESTAGIO_FLUXO.indexOf(
    chamado.estagio as (typeof ORDEM_ESTAGIO_FLUXO)[number]
  );

  return (
    <Card
      size="sm"
      className={cn(
        vencido && "bg-destructive/5 ring-destructive/40",
        aVencer && "ring-amber-500/40",
        concluido && "opacity-60"
      )}
    >
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            #{chamado.numero}
            {novidade && (
              <span
                className="inline-block size-2 shrink-0 rounded-full bg-primary"
                title="Atualizado desde a sua última visita"
              />
            )}
          </span>
          <div className="flex items-center gap-1">
            {novidade && <Badge variant="secondary">Atualizado</Badge>}
            {recorrente && (
              <Badge variant="destructive" title="3+ chamados do mesmo tipo em 6 meses">
                Recorrente
              </Badge>
            )}
            <Badge variant={prioridade.variant}>{prioridade.texto}</Badge>
          </div>
        </div>

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
          <span className="text-muted-foreground line-clamp-1">{chamado.responsavel}</span>
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
