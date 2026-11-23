import { formatarDataHora } from "@/lib/format";
import { ROTULO_SITUACAO_RECEBIMENTO, type SituacaoRecebimento } from "@/lib/suprimentos";
import { Badge } from "@/components/ui/badge";

export type RecebimentoHistorico = {
  id: string;
  situacao: SituacaoRecebimento;
  observacao: string | null;
  nomeRecebedor: string | null;
  documentoRecebedor: string | null;
  recebidoEm: string;
  registradoPor: string | null;
  fotos: { id: string; nome: string }[];
  /** Quantidades deste recebimento (vazio nos registros antigos, sem itens). */
  itens: { descricao: string; unidade: string; recebida: number; devolvida: number }[];
};

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function HistoricoRecebimentos({ recebimentos }: { recebimentos: RecebimentoHistorico[] }) {
  if (recebimentos.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Recebimentos</h3>
      <div className="rounded-md border bg-card divide-y text-sm">
        {recebimentos.map((r) => {
          const quem = r.registradoPor ?? r.nomeRecebedor ?? "—";
          return (
            <div key={r.id} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    r.situacao === "conforme" ? "default" : r.situacao === "parcial" ? "secondary" : "destructive"
                  }
                >
                  {ROTULO_SITUACAO_RECEBIMENTO[r.situacao]}
                </Badge>
                <span>
                  Recebido por <span className="font-medium">{quem}</span>
                  {r.documentoRecebedor ? ` (${r.documentoRecebedor})` : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{formatarDataHora(r.recebidoEm)}</span>
              </div>
              {r.itens.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {r.itens.map((i, n) => (
                    <li key={n}>
                      {i.descricao}: <span className="text-foreground">{qtd(i.recebida)} {i.unidade} aceitos</span>
                      {i.devolvida > 0 && (
                        <span className="text-destructive">
                          {" "}
                          · {qtd(i.devolvida)} {i.unidade} devolvidos
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {r.observacao && <p className="whitespace-pre-line">{r.observacao}</p>}
              {r.fotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.fotos.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/suprimentos/recebimentos/fotos/${f.id}`}
                      target="_blank"
                      rel="noopener"
                      title={f.nome}
                      className="h-20 w-20 overflow-hidden rounded-md border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- link assinado do bucket privado */}
                      <img
                        src={`/api/suprimentos/recebimentos/fotos/${f.id}`}
                        alt={f.nome}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
