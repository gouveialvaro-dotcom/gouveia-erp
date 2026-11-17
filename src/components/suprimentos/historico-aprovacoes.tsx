import { FileText } from "lucide-react";
import { ROTULO_DECISAO, ROTULO_NIVEL, type DecisaoAprovacao, type NivelAlcada } from "@/lib/suprimentos";
import { moeda } from "@/lib/suprimentos-cotacao";
import { formatarDataHora } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export type AprovacaoHistorico = {
  id: string;
  rodada: number;
  nivel: NivelAlcada;
  decisao: DecisaoAprovacao;
  comentario: string | null;
  proprioRequisitante: boolean;
  valorTotal: number;
  anexoNome: string | null;
  decididoEm: string;
  aprovador: string;
};

const VARIANTE: Record<DecisaoAprovacao, "default" | "outline" | "destructive"> = {
  aprovada: "default",
  devolvida: "outline",
  recusada: "destructive",
};

// Linha do tempo das decisões, da mais recente para a mais antiga. Cada envio
// para aprovação é uma rodada; uma devolução encerra a rodada.
export function HistoricoAprovacoes({
  aprovacoes,
  aguardando,
}: {
  aprovacoes: AprovacaoHistorico[];
  /** Níveis que ainda faltam decidir na rodada atual. */
  aguardando: NivelAlcada[];
}) {
  if (aprovacoes.length === 0 && aguardando.length === 0) return null;
  const ordenadas = [...aprovacoes].sort((a, b) => b.decididoEm.localeCompare(a.decididoEm));
  const variasRodadas = new Set(aprovacoes.map((a) => a.rodada)).size > 1;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Aprovação</h3>
      <div className="rounded-md border bg-card divide-y text-sm">
        {aguardando.length > 0 && (
          <div className="p-3 text-muted-foreground">
            Aguardando: {aguardando.map((n) => ROTULO_NIVEL[n]).join(" e ")}
          </div>
        )}
        {ordenadas.map((a) => (
          <div key={a.id} className="flex flex-col gap-1 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={VARIANTE[a.decisao]}>{ROTULO_DECISAO[a.decisao]}</Badge>
              <span className="font-medium">{a.aprovador}</span>
              <span className="text-muted-foreground">· {ROTULO_NIVEL[a.nivel]}</span>
              {variasRodadas && <span className="text-xs text-muted-foreground">· envio {a.rodada}</span>}
              {a.proprioRequisitante && (
                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                  Próprio requisitante
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {moeda(a.valorTotal)} · {formatarDataHora(a.decididoEm)}
              </span>
            </div>
            {a.comentario && <p className="whitespace-pre-line text-muted-foreground">{a.comentario}</p>}
            {a.anexoNome && (
              <a
                href={`/api/suprimentos/aprovacoes/${a.id}/anexo`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1 self-start text-xs text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> {a.anexoNome}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
