"use client";

import { useActionState, useMemo, useState } from "react";
import {
  vincularUsina,
  type EstadoFormUsina,
} from "@/app/(app)/administracao/monitoramento/actions";
import { impedimentoDeVinculo } from "@/lib/monitoramento";
import type { RamoCliente } from "@/lib/clientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export type ClienteOpcao = {
  id: string;
  razaoSocial: string;
  ramo: RamoCliente;
  manutencaoInicio: string | null;
  manutencaoFim: string | null;
};

export type UnidadeOpcao = {
  id: string;
  clienteId: string;
  numero: string;
  apelido: string | null;
  tipo: "geradora" | "beneficiaria";
  ativo: boolean;
};

export function VincularUsinaForm({
  clientes,
  unidades,
}: {
  clientes: ClienteOpcao[];
  unidades: UnidadeOpcao[];
}) {
  const [estado, formAction, pendente] = useActionState<EstadoFormUsina, FormData>(
    vincularUsina,
    undefined
  );
  const [clienteId, setClienteId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  // Só as geradoras do cliente escolhido: é a UC geradora que tem a usina.
  const geradoras = useMemo(
    () => unidades.filter((u) => u.clienteId === clienteId && u.tipo === "geradora" && u.ativo),
    [unidades, clienteId]
  );

  const unidade = geradoras.find((u) => u.id === unidadeId) ?? null;

  // MESMA função do servidor: aqui avisa antes de enviar, lá bloqueia de fato.
  const impedimento = cliente && unidade ? impedimentoDeVinculo(cliente, unidade) : null;
  // Sem UC escolhida ainda não dá para avaliar o par, mas o plano do cliente já
  // dá — e é o motivo mais comum de recusa.
  const impedimentoDoCliente =
    cliente && !unidade
      ? impedimentoDeVinculo(cliente, {
          clienteId: cliente.id,
          tipo: "geradora",
          ativo: true,
        })
      : null;

  const aviso = impedimento ?? impedimentoDoCliente;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="psId">Identificador da planta (ps_id)</Label>
        <Input id="psId" name="psId" required autoComplete="off" />
        <p className="text-xs text-muted-foreground">
          Como aparece no iSolarCloud. Digitado à mão por enquanto — a busca automática das
          plantas depende da integração com a API, ainda não configurada.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomeIsolar">Nome da planta no iSolarCloud</Label>
        <Input id="nomeIsolar" name="nomeIsolar" required autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apelido">Apelido interno (opcional)</Label>
        <Input id="apelido" name="apelido" autoComplete="off" />
        <p className="text-xs text-muted-foreground">
          Manda sobre o nome da API na tela. Útil quando a planta foi cadastrada pelo integrador
          com um código sem sentido.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="potenciaIsolarKwp">Potência informada pela API (kWp, opcional)</Label>
        <Input
          id="potenciaIsolarKwp"
          name="potenciaIsolarKwp"
          type="number"
          step="0.01"
          min="0"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          A potência oficial continua sendo a do cadastro da unidade consumidora. Esta serve para
          a tela mostrar quando as duas divergem.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clienteId">Cliente</Label>
        <SelectNativo
          id="clienteId"
          name="clienteId"
          required
          value={clienteId}
          onChange={(e) => {
            setClienteId(e.target.value);
            setUnidadeId("");
          }}
        >
          <option value="">Selecione…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razaoSocial}
            </option>
          ))}
        </SelectNativo>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unidadeConsumidoraId">Unidade geradora</Label>
        <SelectNativo
          id="unidadeConsumidoraId"
          name="unidadeConsumidoraId"
          required
          value={unidadeId}
          onChange={(e) => setUnidadeId(e.target.value)}
          disabled={!clienteId}
        >
          <option value="">{clienteId ? "Selecione…" : "Escolha o cliente antes"}</option>
          {geradoras.map((u) => (
            <option key={u.id} value={u.id}>
              {u.apelido?.trim() || u.numero}
            </option>
          ))}
        </SelectNativo>
        {clienteId && geradoras.length === 0 && (
          <p className="text-xs text-destructive">
            Este cliente não tem unidade geradora ativa cadastrada.
          </p>
        )}
      </div>

      {aviso && (
        <p className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {aviso}
        </p>
      )}

      {estado?.erro && <p className="sm:col-span-2 text-sm text-destructive">{estado.erro}</p>}
      {estado?.ok && (
        <p className="sm:col-span-2 text-sm text-muted-foreground">Usina vinculada.</p>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendente || aviso !== null}>
          {pendente ? "Vinculando..." : "Vincular usina"}
        </Button>
      </div>
    </form>
  );
}
