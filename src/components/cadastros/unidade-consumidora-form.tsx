"use client";

import { useActionState, useState } from "react";
import {
  adicionarUnidadeConsumidora,
  type EstadoFormUnidade,
} from "@/app/(app)/cadastros/clientes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export function UnidadeConsumidoraForm({
  clienteId,
  concessionarias,
  geradoras,
  obras,
}: {
  clienteId: string;
  concessionarias: { id: string; nome: string }[];
  geradoras: { id: string; rotulo: string }[];
  obras: { id: string; rotulo: string }[];
}) {
  const adicionarComCliente = adicionarUnidadeConsumidora.bind(null, clienteId);
  const [estado, formAction, pendente] = useActionState<EstadoFormUnidade, FormData>(
    adicionarComCliente,
    undefined
  );
  const [tipo, setTipo] = useState("geradora");

  return (
    <form action={formAction} className="grid gap-3 max-w-3xl md:grid-cols-4 items-end mb-8">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="numero">Número da UC</Label>
        <Input id="numero" name="numero" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apelido">Apelido</Label>
        <Input id="apelido" name="apelido" placeholder="Ex.: Matriz" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="concessionariaId">Concessionária</Label>
        <SelectNativo id="concessionariaId" name="concessionariaId" required>
          <option value="">Selecione</option>
          {concessionarias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </SelectNativo>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo">Tipo</Label>
        <SelectNativo
          id="tipo"
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="geradora">Geradora</option>
          <option value="beneficiaria">Beneficiária</option>
        </SelectNativo>
      </div>

      {tipo === "beneficiaria" ? (
        <>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="geradoraId">Compensada pela geradora</Label>
            <SelectNativo id="geradoraId" name="geradoraId">
              <option value="">
                {geradoras.length === 0 ? "Cadastre a geradora primeiro" : "Selecione"}
              </option>
              {geradoras.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.rotulo}
                </option>
              ))}
            </SelectNativo>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="percentualRateio">Rateio (%)</Label>
            <Input
              id="percentualRateio"
              name="percentualRateio"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="potenciaKwp">Potência (kWp)</Label>
          <Input id="potenciaKwp" name="potenciaKwp" type="number" step="0.01" min="0" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="obraId">Obra de origem</Label>
        <SelectNativo id="obraId" name="obraId">
          <option value="">
            {obras.length === 0 ? "Sem obra registrada" : "Sem vínculo"}
          </option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </SelectNativo>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titular">Titular na concessionária</Label>
        <Input id="titular" name="titular" />
      </div>
      <div className="grid grid-cols-[1fr_4rem] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" name="cidade" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="uf">UF</Label>
          <Input id="uf" name="uf" maxLength={2} />
        </div>
      </div>

      <div className="md:col-span-4 flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pendente || concessionarias.length === 0}>
          {pendente ? "Salvando..." : "+ Unidade consumidora"}
        </Button>
        {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
      </div>
    </form>
  );
}
