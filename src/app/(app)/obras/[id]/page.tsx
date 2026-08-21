import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData, formatarMoeda } from "@/lib/format";
import {
  ROTULO_ORIGEM_OBRA,
  ROTULO_STATUS_OBRA,
  clienteDaObra,
  projetoDaObra,
} from "@/lib/obras";
import { ObraForm } from "@/components/obras/obra-form";
import { Badge } from "@/components/ui/badge";

export default async function PaginaObra({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("obras");
  const { id } = await params;

  const { data: obra } = await supabase
    .from("Obra")
    .select(
      "*, cliente:Cliente(id, razaoSocial), oportunidade:Oportunidade(id, cliente:Cliente(id, razaoSocial), orcamento:Orcamento(id, nomeProjeto)), atualizadoPor:Usuario(nome)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!obra) notFound();

  const podeEditar = podeEscrever(perfil, "obras");
  const status = ROTULO_STATUS_OBRA[obra.status] ?? {
    texto: obra.status,
    variant: "outline" as const,
  };

  return (
    <div className="flex flex-col gap-1">
      <Link href="/obras" className="text-sm text-muted-foreground hover:underline w-fit">
        ← Obras
      </Link>
      <div className="flex items-center gap-3 mt-2">
        <h2 className="text-lg font-semibold">{clienteDaObra(obra)}</h2>
        <Badge variant={status.variant}>{status.texto}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {obra.oportunidade ? (
          <>
            <Link
              href={`/orcamentos/${obra.oportunidade.orcamento?.id}`}
              className="hover:underline"
            >
              {projetoDaObra(obra)}
            </Link>
            {" · "}
            <Link href={`/crm/${obra.oportunidade.id}`} className="hover:underline">
              Ver oportunidade
            </Link>
          </>
        ) : (
          <>
            {projetoDaObra(obra)}
            {" · "}
            {ROTULO_ORIGEM_OBRA.manual}
          </>
        )}
        {obra.atualizadoPor?.nome && (
          <>
            {" · "}Atualizada por {obra.atualizadoPor.nome} em {formatarData(obra.atualizadoEm)}
          </>
        )}
      </p>

      {podeEditar ? (
        <ObraForm
          obra={{
            id: obra.id,
            status: obra.status,
            avancoFisicoPercent: obra.avancoFisicoPercent,
            custoOrcado: obra.custoOrcado,
            custoRealizado: obra.custoRealizado,
            dataInicio: obra.dataInicio,
            dataPrevistaConclusao: obra.dataPrevistaConclusao,
          }}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-3 max-w-2xl text-sm">
          <div>
            <dt className="text-muted-foreground">Avanço físico</dt>
            <dd>{obra.avancoFisicoPercent}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Custo orçado</dt>
            <dd>{formatarMoeda(obra.custoOrcado)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Custo realizado</dt>
            <dd>{formatarMoeda(obra.custoRealizado)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Data de início</dt>
            <dd>{obra.dataInicio ? formatarData(obra.dataInicio) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Previsão de conclusão</dt>
            <dd>
              {obra.dataPrevistaConclusao ? formatarData(obra.dataPrevistaConclusao) : "—"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
