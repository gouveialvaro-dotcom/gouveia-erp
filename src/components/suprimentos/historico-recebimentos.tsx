import { formatarDataHora } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export type RecebimentoHistorico = {
  id: string;
  situacao: "conforme" | "inconforme";
  observacao: string | null;
  nomeRecebedor: string;
  documentoRecebedor: string | null;
  recebidoEm: string;
  registradoPor: string | null;
  fotos: { id: string; nome: string }[];
};

export function HistoricoRecebimentos({ recebimentos }: { recebimentos: RecebimentoHistorico[] }) {
  if (recebimentos.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Recebimentos</h3>
      <div className="rounded-md border bg-card divide-y text-sm">
        {recebimentos.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={r.situacao === "conforme" ? "default" : "destructive"}>
                {r.situacao === "conforme" ? "Conforme" : "Inconforme"}
              </Badge>
              <span>
                Recebido por <span className="font-medium">{r.nomeRecebedor}</span>
                {r.documentoRecebedor ? ` (${r.documentoRecebedor})` : ""}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatarDataHora(r.recebidoEm)}
                {r.registradoPor && r.registradoPor !== r.nomeRecebedor ? ` · lançado por ${r.registradoPor}` : ""}
              </span>
            </div>
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
        ))}
      </div>
    </section>
  );
}
