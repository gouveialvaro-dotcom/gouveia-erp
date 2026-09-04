import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData, formatarMoeda } from "@/lib/format";
import { ORDEM_ESTAGIO_KANBAN, ORDEM_ESTAGIO_FLUXO, ROTULO_ESTAGIO } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { avancarEstagio, voltarEstagio } from "./actions";
import { TituloPagina } from "@/components/titulo-pagina";

export default async function PaginaCrm() {
  const { perfil } = await acessoModulo("crm");
  const podeEditar = podeEscrever(perfil, "crm");

  const { data } = await supabase
    .from("Oportunidade")
    .select(
      "*, cliente:Cliente(razaoSocial), orcamento:Orcamento(nomeProjeto), responsavel:Usuario(nome)"
    )
    .order("criadoEm", { ascending: false });

  const oportunidades = data ?? [];
  const hoje = new Date().toLocaleDateString("sv-SE");

  return (
    <div className="flex flex-col gap-4">
      <TituloPagina
        titulo="CRM / Propostas"
        subtitulo={`Funil de oportunidades comerciais — ${oportunidades.length} no total`}
      />

      {podeEditar && (
        <div className="flex justify-end">
          <Button render={<Link href="/crm/novo" />} nativeButton={false}>
            + Nova oportunidade
          </Button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {ORDEM_ESTAGIO_KANBAN.map((estagio) => {
          const itens = oportunidades.filter((o) => o.estagio === estagio);
          return (
            <div key={estagio} className="flex w-72 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{ROTULO_ESTAGIO[estagio]}</h2>
                <Badge variant="outline">{itens.length}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                {itens.map((o) => {
                  const atrasada = !!o.proximaAcaoData && o.proximaAcaoData.slice(0, 10) < hoje;
                  const indiceFluxo = ORDEM_ESTAGIO_FLUXO.indexOf(
                    o.estagio as (typeof ORDEM_ESTAGIO_FLUXO)[number]
                  );
                  const podeMover = podeEditar && indiceFluxo >= 0;

                  return (
                    <Card key={o.id} size="sm">
                      <CardContent className="flex flex-col gap-2">
                        <Link href={`/crm/${o.id}`} className="font-medium hover:underline">
                          {o.cliente?.razaoSocial ?? "—"}
                        </Link>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {o.orcamento?.nomeProjeto}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span>{o.valorEstimado ? formatarMoeda(o.valorEstimado) : "—"}</span>
                          <span className="text-muted-foreground">{o.responsavel?.nome ?? "—"}</span>
                        </div>
                        {o.proximaAcaoData && (
                          <Badge variant={atrasada ? "destructive" : "outline"} className="w-fit">
                            {formatarData(o.proximaAcaoData)}
                          </Badge>
                        )}
                        {podeMover && (
                          <div className="flex gap-1 pt-1">
                            {indiceFluxo > 0 && (
                              <form
                                action={async () => {
                                  "use server";
                                  await voltarEstagio(o.id, o.estagio);
                                }}
                              >
                                <Button type="submit" variant="outline" size="xs">
                                  ← Voltar
                                </Button>
                              </form>
                            )}
                            {indiceFluxo < ORDEM_ESTAGIO_FLUXO.length - 1 && (
                              <form
                                action={async () => {
                                  "use server";
                                  await avancarEstagio(o.id, o.estagio);
                                }}
                              >
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
                })}
                {itens.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-4 text-center">
                    Nenhuma oportunidade
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
