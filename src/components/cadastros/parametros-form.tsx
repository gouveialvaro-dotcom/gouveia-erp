"use client";

import { useActionState } from "react";
import { salvarParametros, type EstadoFormParametros } from "@/app/(app)/cadastros/parametros/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ParametrosValues = {
  bdiPadrao: string;
  encargosSociais: string;
  impostos: string;
  margemMinima: string;
  validadePropostaPadraoDias: number;
  diasUteisMes: number;
  tetoDiarioAvisosProgramacao: number;
  textoImpostosPadrao: string;
};

export function ParametrosForm({
  parametros,
  somenteLeitura,
}: {
  parametros: ParametrosValues;
  somenteLeitura: boolean;
}) {
  const [estado, formAction, pendente] = useActionState<EstadoFormParametros, FormData>(
    salvarParametros,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bdiPadrao">BDI padrão (%)</Label>
          <Input id="bdiPadrao" name="bdiPadrao" type="number" step="0.01" defaultValue={parametros.bdiPadrao} disabled={somenteLeitura} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="encargosSociais">Encargos sociais sobre mão de obra (%)</Label>
          <Input id="encargosSociais" name="encargosSociais" type="number" step="0.01" defaultValue={parametros.encargosSociais} disabled={somenteLeitura} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="impostos">Impostos (%)</Label>
          <Input id="impostos" name="impostos" type="number" step="0.01" defaultValue={parametros.impostos} disabled={somenteLeitura} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="margemMinima">Margem mínima aceitável (%)</Label>
          <Input id="margemMinima" name="margemMinima" type="number" step="0.01" defaultValue={parametros.margemMinima} disabled={somenteLeitura} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="validadePropostaPadraoDias">Validade padrão da proposta (dias)</Label>
          <Input id="validadePropostaPadraoDias" name="validadePropostaPadraoDias" type="number" defaultValue={parametros.validadePropostaPadraoDias} disabled={somenteLeitura} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="diasUteisMes">Dias úteis considerados por mês</Label>
          <Input id="diasUteisMes" name="diasUteisMes" type="number" defaultValue={parametros.diasUteisMes} disabled={somenteLeitura} required />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="tetoDiarioAvisosProgramacao">
            Teto diário de avisos de programação
          </Label>
          <Input
            id="tetoDiarioAvisosProgramacao"
            name="tetoDiarioAvisosProgramacao"
            type="number"
            min="0"
            defaultValue={parametros.tetoDiarioAvisosProgramacao}
            disabled={somenteLeitura}
            required
          />
          {/* Não é regra de negócio da empresa: é contenção técnica. O aviso de
              programação sai pelo mesmo número corporativo do atendimento, por
              uma integração não oficial, e volume alto é o que leva ao bloqueio
              pela Meta. Fica aqui para poder ser afrouxado sem deploy. */}
          <p className="text-xs text-muted-foreground">
            Limite de mensagens que a publicação da programação pode disparar por dia. Existe
            para proteger o número corporativo — a integração do WhatsApp não é oficial.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 max-w-2xl">
        <Label htmlFor="textoImpostosPadrao">Texto padrão de impostos incidentes (usado nas propostas)</Label>
        <Textarea
          id="textoImpostosPadrao"
          name="textoImpostosPadrao"
          rows={6}
          defaultValue={parametros.textoImpostosPadrao}
          disabled={somenteLeitura}
          required
        />
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
      {estado?.sucesso && <p className="text-sm text-primary">Parâmetros salvos com sucesso.</p>}

      {!somenteLeitura && (
        <div>
          <Button type="submit" disabled={pendente}>
            {pendente ? "Salvando..." : "Salvar parâmetros"}
          </Button>
        </div>
      )}
    </form>
  );
}
