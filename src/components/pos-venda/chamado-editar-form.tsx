"use client";

import { useActionState, useState } from "react";
import { atualizarChamado, type EstadoFormChamado } from "@/app/(app)/pos-venda/actions";
import { formatarData } from "@/lib/format";
import {
  ORDEM_ESTAGIO_FLUXO,
  ROTULO_ESTAGIO,
  ROTULO_PRIORIDADE,
  somarDias,
  type EstagioChamado,
  type PrioridadeChamado,
} from "@/lib/pos-venda";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Textarea } from "@/components/ui/textarea";
import type { ObraOpcao, TipoProblemaOpcao, UnidadeOpcao } from "./chamado-criar-form";

type ChamadoFormValues = {
  id: string;
  estagio: EstagioChamado;
  tipoProblemaId: string;
  prioridade: PrioridadeChamado;
  unidadeConsumidoraId: string | null;
  obraId: string | null;
  abertoEm: string;
  prazoLimite: string;
  protocoloConcessionaria: string | null;
  solucao: string | null;
};

export function ChamadoEditarForm({
  chamado,
  unidades,
  obras,
  tipos,
}: {
  chamado: ChamadoFormValues;
  unidades: UnidadeOpcao[];
  obras: ObraOpcao[];
  tipos: TipoProblemaOpcao[];
}) {
  const atualizarComId = atualizarChamado.bind(null, chamado.id);
  const [estado, formAction, pendente] = useActionState<EstadoFormChamado, FormData>(
    atualizarComId,
    undefined
  );

  const [estagio, setEstagio] = useState<string>(chamado.estagio);
  const [tipoId, setTipoId] = useState(chamado.tipoProblemaId);
  const [prazoLimite, setPrazoLimite] = useState(chamado.prazoLimite.slice(0, 10));

  const tipo = tipos.find((t) => t.id === tipoId);
  // Trocar o tipo muda o SLA acordado; o prazo já gravado só é substituído se
  // o usuário confirmar, para não apagar uma prorrogação combinada à mão.
  const prazoSugerido = tipo ? somarDias(chamado.abertoEm, tipo.prazoDias) : null;
  const prazoDivergente = prazoSugerido !== null && prazoSugerido !== prazoLimite;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-3xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estagio">Estágio</Label>
          <SelectNativo
            id="estagio"
            name="estagio"
            value={estagio}
            onChange={(e) => setEstagio(e.target.value)}
          >
            {ORDEM_ESTAGIO_FLUXO.map((e) => (
              <option key={e} value={e}>
                {ROTULO_ESTAGIO[e]}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prioridade">Prioridade</Label>
          <SelectNativo id="prioridade" name="prioridade" defaultValue={chamado.prioridade}>
            {Object.entries(ROTULO_PRIORIDADE).map(([valor, { texto }]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipoProblemaId">Tipo de problema</Label>
          <SelectNativo
            id="tipoProblemaId"
            name="tipoProblemaId"
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
          >
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} ({t.prazoDias}d)
              </option>
            ))}
          </SelectNativo>
        </div>

        {/* O responsável não é editado aqui: repassar o chamado é ação
            separada, no cabeçalho, com autorização própria (dono ou admin) e
            registro na linha do tempo. */}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unidadeConsumidoraId">Unidade consumidora</Label>
          <SelectNativo
            id="unidadeConsumidoraId"
            name="unidadeConsumidoraId"
            defaultValue={chamado.unidadeConsumidoraId ?? ""}
          >
            <option value="">
              {unidades.length === 0 ? "Cliente sem UC cadastrada" : "Sem UC específica"}
            </option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.rotulo}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obraId">Obra de origem</Label>
          <SelectNativo id="obraId" name="obraId" defaultValue={chamado.obraId ?? ""}>
            <option value="">
              {obras.length === 0 ? "Cliente sem obra registrada" : "Sem obra vinculada"}
            </option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prazoLimite">Prazo limite</Label>
          <CampoData
            id="prazoLimite"
            name="prazoLimite"
            value={prazoLimite}
            aoMudar={setPrazoLimite}
            required
          />
          {prazoDivergente && (
            <p className="text-xs text-muted-foreground">
              SLA do tipo indica {formatarData(prazoSugerido)}.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setPrazoLimite(prazoSugerido)}
              >
                Usar esse prazo
              </button>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="protocoloConcessionaria">Protocolo da concessionária</Label>
          <Input
            id="protocoloConcessionaria"
            name="protocoloConcessionaria"
            defaultValue={chamado.protocoloConcessionaria ?? ""}
          />
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="solucao">
            Solução {estagio === "concluido" && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="solucao"
            name="solucao"
            rows={3}
            defaultValue={chamado.solucao ?? ""}
            placeholder="O que resolveu o problema — vira base de consulta nos casos recorrentes."
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar chamado"}
        </Button>
      </div>
    </form>
  );
}
