"use client";

import { useActionState, useState } from "react";
import { salvarCliente, type EstadoFormCliente } from "@/app/(app)/cadastros/clientes/actions";
import { RAMOS, ROTULO_RAMO, type RamoCliente } from "@/lib/clientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Textarea } from "@/components/ui/textarea";

export type ClienteFormValues = {
  id: string;
  ramo: RamoCliente;
  razaoSocial: string;
  cnpj: string;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
  manutencaoInicio: string | null;
  manutencaoFim: string | null;
};

export function ClienteForm({
  ramo: ramoInicial,
  cliente,
}: {
  ramo: RamoCliente;
  cliente?: ClienteFormValues;
}) {
  const salvarComId = salvarCliente.bind(null, cliente?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormCliente, FormData>(
    salvarComId,
    undefined
  );

  // Na criação o ramo vem da tela de origem; na edição dá para corrigir a
  // classificação — é o ramo que decide os campos e o acesso ao pós-venda.
  const [ramo, setRamo] = useState<RamoCliente>(ramoInicial);
  const solar = ramo === "energia_solar";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {!cliente && <input type="hidden" name="ramo" value={ramo} />}

      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        {cliente && (
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="ramo">Ramo de atividade</Label>
            <SelectNativo
              id="ramo"
              name="ramo"
              value={ramo}
              onChange={(e) => setRamo(e.target.value as RamoCliente)}
            >
              {RAMOS.map((r) => (
                <option key={r} value={r}>
                  {ROTULO_RAMO[r]}
                </option>
              ))}
            </SelectNativo>
          </div>
        )}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="razaoSocial">Razão social</Label>
          <Input id="razaoSocial" name="razaoSocial" defaultValue={cliente?.razaoSocial} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnpj">CNPJ / CPF</Label>
          <Input id="cnpj" name="cnpj" defaultValue={cliente?.cnpj} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contato">Contato do cliente</Label>
          <Input
            id="contato"
            name="contato"
            placeholder="Nome de quem responde pelo cliente"
            defaultValue={cliente?.contato ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={cliente?.telefone ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={cliente?.email ?? ""} />
        </div>

        {solar ? (
          <div className="col-span-2 grid grid-cols-2 gap-4 rounded-md border bg-muted/30 p-3">
            <p className="col-span-2 text-sm text-muted-foreground">
              Contrato de manutenção — o pós-venda só aceita abrir chamado deste cliente dentro
              deste período.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manutencaoInicio">Ativação da manutenção</Label>
              <Input
                id="manutencaoInicio"
                name="manutencaoInicio"
                type="date"
                defaultValue={cliente?.manutencaoInicio?.slice(0, 10) ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manutencaoFim">Fim da manutenção</Label>
              <Input
                id="manutencaoFim"
                name="manutencaoFim"
                type="date"
                defaultValue={cliente?.manutencaoFim?.slice(0, 10) ?? ""}
              />
            </div>
          </div>
        ) : (
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" name="endereco" defaultValue={cliente?.endereco ?? ""} />
          </div>
        )}

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            name="observacoes"
            rows={3}
            defaultValue={cliente?.observacoes ?? ""}
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar cliente"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {!cliente && `Ramo: ${ROTULO_RAMO[ramo]}`}
          {solar && cliente && "Unidades geradoras e beneficiárias são cadastradas abaixo."}
        </span>
      </div>
    </form>
  );
}
