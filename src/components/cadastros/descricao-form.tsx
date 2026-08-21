"use client";

import { useActionState } from "react";
import {
  salvarDescricaoPadrao,
  type EstadoFormDescricao,
} from "@/app/(app)/cadastros/descricoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DescricaoFormValues = {
  id: string;
  nome: string;
  tipoProposta: "usina_solar" | "redes";
  texto: string;
};

export function DescricaoForm({ descricao }: { descricao?: DescricaoFormValues }) {
  const salvarComId = salvarDescricaoPadrao.bind(null, descricao?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormDescricao, FormData>(
    salvarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome do modelo</Label>
          <Input id="nome" name="nome" defaultValue={descricao?.nome} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipoProposta">Tipo de proposta</Label>
          <Select
            name="tipoProposta"
            defaultValue={descricao?.tipoProposta ?? "usina_solar"}
            items={[
              { value: "usina_solar", label: "Usina Solar" },
              { value: "redes", label: "Redes" },
            ]}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usina_solar">Usina Solar</SelectItem>
              <SelectItem value="redes">Redes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 max-w-2xl">
        <Label htmlFor="texto">Texto padrão da descrição</Label>
        <Textarea id="texto" name="texto" rows={5} defaultValue={descricao?.texto} required />
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar descrição padrão"}
        </Button>
      </div>
    </form>
  );
}
