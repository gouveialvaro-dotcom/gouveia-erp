"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  salvarIndisponibilidade,
  type EstadoFormIndisponibilidade,
} from "@/app/(app)/programacao/actions";
import {
  ROTULO_TIPO_INDISPONIBILIDADE,
  type TipoIndisponibilidade,
} from "@/lib/programacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoData } from "@/components/ui/campo-data";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpcaoSimples } from "@/components/programacao/painel-linha";

export function FormIndisponibilidade({
  funcionarios,
  veiculos,
}: {
  funcionarios: OpcaoSimples[];
  veiculos: OpcaoSimples[];
}) {
  const [estado, formAction, pendente] = useActionState<EstadoFormIndisponibilidade, FormData>(
    salvarIndisponibilidade,
    undefined
  );
  const [tipo, setTipo] = useState<TipoIndisponibilidade>("funcionario");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Indisponibilidade registrada.");
      formRef.current?.reset();
    }
  }, [estado]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar indisponibilidade</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-3 md:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <SelectNativo
              id="tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoIndisponibilidade)}
            >
              {(Object.keys(ROTULO_TIPO_INDISPONIBILIDADE) as TipoIndisponibilidade[]).map(
                (opcao) => (
                  <option key={opcao} value={opcao}>
                    {ROTULO_TIPO_INDISPONIBILIDADE[opcao]}
                  </option>
                )
              )}
            </SelectNativo>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={tipo === "funcionario" ? "funcionarioId" : "veiculoId"}>
              {tipo === "funcionario" ? "Funcionário" : "Veículo"}
            </Label>
            {tipo === "funcionario" ? (
              <SelectNativo id="funcionarioId" name="funcionarioId" defaultValue="">
                <option value="">Selecione...</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </SelectNativo>
            ) : (
              <SelectNativo id="veiculoId" name="veiculoId" defaultValue="">
                <option value="">Selecione...</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </SelectNativo>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dataInicio">De</Label>
            <CampoData id="dataInicio" name="dataInicio" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dataFim">Até (inclusive)</Label>
            <CampoData id="dataFim" name="dataFim" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo">Motivo</Label>
            <Input id="motivo" name="motivo" placeholder="Férias / Em manutenção" required />
          </div>

          <div className="md:col-span-5 flex items-center gap-3">
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando..." : "Registrar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O motivo aparece na tela de programação quando alguém tentar alocar — por isso
              vale escrever algo que a logística entenda de relance.
            </p>
          </div>

          {estado?.erro && (
            <p className="md:col-span-5 text-sm text-destructive">{estado.erro}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
