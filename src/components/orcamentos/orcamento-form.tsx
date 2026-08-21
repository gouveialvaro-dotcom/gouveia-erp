"use client";

import { useActionState, useState } from "react";
import { salvarOrcamento, type EstadoFormOrcamento } from "@/app/(app)/orcamentos/actions";
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
import { ComboboxCampo, type OpcaoCombobox } from "@/components/ui/combobox-campo";

type OrcamentoFormValues = {
  id: string;
  nomeProjeto: string;
  clienteId: string;
  tipoProposta: "usina_solar" | "redes";
  descricao: string | null;
  status: "em_elaboracao" | "finalizado" | "revisao";
};

type DescricaoPadrao = {
  id: string;
  nome: string;
  tipoProposta: "usina_solar" | "redes";
  texto: string;
};

export function OrcamentoForm({
  orcamento,
  clientes,
  descricoesPadrao = [],
}: {
  orcamento?: OrcamentoFormValues;
  clientes: { id: string; razaoSocial: string }[];
  descricoesPadrao?: DescricaoPadrao[];
}) {
  const salvarComId = salvarOrcamento.bind(null, orcamento?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormOrcamento, FormData>(
    salvarComId,
    undefined
  );

  const clienteItems: OpcaoCombobox[] = clientes.map((c) => ({
    value: c.id,
    label: c.razaoSocial,
  }));

  // A descrição é o texto que o cliente lê na proposta, então é controlada aqui
  // para que aplicar um modelo do catálogo preencha o campo sem apagar edições
  // já feitas à mão sem aviso.
  const [tipoProposta, setTipoProposta] = useState(orcamento?.tipoProposta ?? "usina_solar");
  const [descricao, setDescricao] = useState(orcamento?.descricao ?? "");

  const modelosDoTipo = descricoesPadrao.filter((d) => d.tipoProposta === tipoProposta);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="nomeProjeto">Nome do projeto</Label>
          <Input id="nomeProjeto" name="nomeProjeto" defaultValue={orcamento?.nomeProjeto} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clienteId">Cliente</Label>
          <ComboboxCampo
            name="clienteId"
            id="clienteId"
            itens={clienteItems}
            itemInicial={clienteItems.find((c) => c.value === orcamento?.clienteId) ?? null}
            placeholder="Buscar cliente..."
            textoVazio="Nenhum cliente encontrado."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipoProposta">Tipo de proposta</Label>
          <Select
            name="tipoProposta"
            value={tipoProposta}
            onValueChange={(valor) => setTipoProposta(valor as "usina_solar" | "redes")}
            items={[
              { value: "usina_solar", label: "Usina Solar" },
              { value: "redes", label: "Redes" },
            ]}
          >
            <SelectTrigger id="tipoProposta" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usina_solar">Usina Solar</SelectItem>
              <SelectItem value="redes">Redes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {orcamento && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              name="status"
              defaultValue={orcamento.status}
              items={[
                { value: "em_elaboracao", label: "Em elaboração" },
                { value: "revisao", label: "Em revisão" },
                { value: "finalizado", label: "Finalizado" },
              ]}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_elaboracao">Em elaboração</SelectItem>
                <SelectItem value="revisao">Em revisão</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="col-span-2 flex flex-col gap-1.5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <Label htmlFor="descricao">Descrição dos serviços</Label>
            {modelosDoTipo.length > 0 && (
              <Select
                value=""
                onValueChange={(valor) => {
                  const modelo = modelosDoTipo.find((m) => m.id === valor);
                  if (modelo) setDescricao(modelo.texto);
                }}
              >
                <SelectTrigger size="sm" className="max-w-[280px]">
                  <SelectValue placeholder="Aplicar descrição padrão..." />
                </SelectTrigger>
                <SelectContent>
                  {modelosDoTipo.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea
            id="descricao"
            name="descricao"
            rows={6}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            É este texto que o cliente lê na proposta. Os modelos vêm de Cadastros → Descrições
            padrão e podem ser editados aqui sem alterar o catálogo.
          </span>
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar orçamento"}
        </Button>
      </div>
    </form>
  );
}
