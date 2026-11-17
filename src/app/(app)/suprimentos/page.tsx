import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { PAPEIS, ROTULO_PAPEL, STATUS_EM_ANDAMENTO, codigoRequisicao } from "@/lib/suprimentos";
import { formatarData } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeStatusRequisicao, BadgeUrgencia } from "@/components/suprimentos/status-requisicao";

function Indicador({ titulo, valor, href }: { titulo: string; valor: number; href: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        <Link href={href} className="hover:underline">
          {valor}
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function PaginaSuprimentos() {
  const { usuarioId, papeis, ehAdmin, tem } = await contextoSuprimentos();
  const comprador = tem("comprador");

  const contar = (status: "pendente" | "em_cotacao") =>
    supabase.from("Requisicao").select("id", { count: "exact", head: true }).eq("status", status);

  const [minhas, pendentes, emCotacao, revisar] = await Promise.all([
    supabase
      .from("Requisicao")
      .select("id, numero, status, urgencia, prazoDesejado, obra:Obra(nomeProjeto)")
      .eq("requisitanteId", usuarioId)
      .in("status", STATUS_EM_ANDAMENTO)
      .order("numero", { ascending: false })
      .limit(10),
    comprador ? contar("pendente") : Promise.resolve({ count: 0 }),
    comprador ? contar("em_cotacao") : Promise.resolve({ count: 0 }),
    comprador
      ? supabase
          .from("Produto")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .eq("revisar", true)
      : Promise.resolve({ count: 0 }),
  ]);

  const meusPapeis = PAPEIS.filter((papel) => papeis.has(papel));
  const minhasAbertas = minhas.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Seus papéis no módulo:</span>
          {ehAdmin && <Badge>Administrador</Badge>}
          {meusPapeis.map((papel) => (
            <Badge key={papel} variant="secondary">
              {ROTULO_PAPEL[papel]}
            </Badge>
          ))}
          {!ehAdmin && meusPapeis.length === 0 && <span>Requisitante</span>}
        </div>
        <Button render={<Link href="/suprimentos/requisicoes/nova" />} nativeButton={false} size="lg">
          + Nova requisição
        </Button>
      </div>

      {comprador && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador
            titulo="Requisições aguardando cotação"
            valor={pendentes.count ?? 0}
            href="/suprimentos/requisicoes?escopo=todas&status=pendente"
          />
          <Indicador
            titulo="Em cotação"
            valor={emCotacao.count ?? 0}
            href="/suprimentos/requisicoes?escopo=todas&status=em_cotacao"
          />
          <Indicador titulo="Produtos a revisar" valor={revisar.count ?? 0} href="/suprimentos/produtos?revisar=1" />
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Minhas requisições em andamento</h2>
        {minhasAbertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma requisição em andamento.</p>
        ) : (
          <ul className="rounded-md border bg-card divide-y">
            {minhasAbertas.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/suprimentos/requisicoes/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-muted"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{codigoRequisicao(r.numero)}</span>
                    <span className="text-sm text-muted-foreground">{r.obra?.nomeProjeto}</span>
                    <BadgeUrgencia urgencia={r.urgencia} />
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    até {formatarData(r.prazoDesejado)}
                    <BadgeStatusRequisicao status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
