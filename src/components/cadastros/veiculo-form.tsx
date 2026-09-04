"use client";

import { useActionState, useState } from "react";
import { salvarVeiculo, type EstadoFormVeiculo } from "@/app/(app)/cadastros/veiculos/actions";
import {
  ROTULO_TIPO_VEICULO,
  normalizarPlaca,
  placaValida,
  type TipoVeiculo,
} from "@/lib/programacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectNativo } from "@/components/ui/select-nativo";

export type VeiculoFormValues = {
  id: string;
  placa: string;
  modelo: string;
  tipo: TipoVeiculo;
  identificacao: string | null;
  ativo: boolean;
};

export function VeiculoForm({ veiculo }: { veiculo?: VeiculoFormValues }) {
  const salvarComId = salvarVeiculo.bind(null, veiculo?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormVeiculo, FormData>(
    salvarComId,
    undefined
  );

  // A placa é normalizada enquanto se digita, com a MESMA função do servidor:
  // o campo mostra exatamente o que será gravado, em vez de aceitar "pga-1a23"
  // e devolver "PGA1A23" depois de salvar.
  const [placa, setPlaca] = useState(veiculo?.placa ?? "");
  const placaIncompleta = placa.length > 0 && !placaValida(placa);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="placa">Placa</Label>
          <Input
            id="placa"
            name="placa"
            value={placa}
            onChange={(e) => setPlaca(normalizarPlaca(e.target.value))}
            maxLength={7}
            placeholder="PGA1A23"
            required
          />
          {placaIncompleta && (
            <p className="text-xs text-destructive">
              Padrão brasileiro: AAA1234 (antigo) ou AAA1A23 (Mercosul).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <SelectNativo id="tipo" name="tipo" defaultValue={veiculo?.tipo ?? "caminhonete"}>
            {(Object.keys(ROTULO_TIPO_VEICULO) as TipoVeiculo[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULO_TIPO_VEICULO[tipo]}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="modelo">Modelo</Label>
          <Input
            id="modelo"
            name="modelo"
            defaultValue={veiculo?.modelo}
            placeholder="Hilux SR 2022"
            required
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="identificacao">Identificação interna (opcional)</Label>
          <Input
            id="identificacao"
            name="identificacao"
            defaultValue={veiculo?.identificacao ?? ""}
            placeholder="Caminhonete 03"
          />
          <p className="text-xs text-muted-foreground">
            É como a operação chama o carro no dia a dia. Aparece junto da placa na
            programação e nas mensagens.
          </p>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox name="ativo" defaultChecked={veiculo?.ativo ?? true} />
            Ativo
          </Label>
          <p className="text-xs text-muted-foreground">
            Veículo baixado sai das listas de alocação sem apagar o histórico de
            programação em que já apareceu.
          </p>
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar veículo"}
        </Button>
      </div>
    </form>
  );
}
