"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  salvarFuncionario,
  type EstadoFormFuncionario,
} from "@/app/(app)/cadastros/funcionarios/actions";
import { formatarMoeda } from "@/lib/format";
import { custoDiarioMaoObra, custoMensalMaoObra } from "@/lib/mao-obra";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboboxCampo } from "@/components/ui/combobox-campo";
import { CampoTelefone } from "@/components/ui/campo-telefone";

export type OpcaoFuncao = {
  id: string;
  nome: string;
  salarioMensal: number;
  encargosPercent: number;
};

type FuncionarioFormValues = {
  id: string;
  nome: string;
  funcaoId: string | null;
  salarioMensal: string;
  encargosPercent: string;
  ativo: boolean;
  telefone: string | null;
  recebeProgramacao: boolean;
};

export function FuncionarioForm({
  funcoes,
  diasUteisMes,
  funcionario,
}: {
  funcoes: OpcaoFuncao[];
  diasUteisMes: number;
  funcionario?: FuncionarioFormValues;
}) {
  const salvarComId = salvarFuncionario.bind(null, funcionario?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormFuncionario, FormData>(
    salvarComId,
    undefined
  );

  // Salário e encargos são controlados porque escolher uma função os
  // reescreve. Continuam editáveis depois: a função é o piso do cargo, e
  // alguém pode ganhar acima dele sem que isso mexa no catálogo.
  const [salarioMensal, setSalarioMensal] = useState(funcionario?.salarioMensal ?? "");
  const [encargosPercent, setEncargosPercent] = useState(funcionario?.encargosPercent ?? "");

  const itens = funcoes.map((f) => ({ value: f.id, label: f.nome }));
  const itemInicial = itens.find((i) => i.value === funcionario?.funcaoId) ?? null;

  function preencherPelaFuncao(funcaoId: string | null) {
    const funcao = funcoes.find((f) => f.id === funcaoId);
    if (!funcao) return;
    setSalarioMensal(String(funcao.salarioMensal));
    setEncargosPercent(String(funcao.encargosPercent));
  }

  const custo = { salarioMensal: Number(salarioMensal), encargosPercent: Number(encargosPercent) };
  const custoVisivel = Number.isFinite(custo.salarioMensal) && custo.salarioMensal > 0;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" defaultValue={funcionario?.nome} required />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="funcaoId">Função/Cargo</Label>
            <Link
              href="/cadastros/funcoes"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Cadastrar nova função
            </Link>
          </div>
          <ComboboxCampo
            id="funcaoId"
            name="funcaoId"
            itens={itens}
            itemInicial={itemInicial}
            placeholder="Buscar função..."
            textoVazio="Nenhuma função encontrada."
            aoSelecionar={(opcao) => preencherPelaFuncao(opcao?.value ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Escolher a função preenche salário e encargos com o custo do catálogo.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="salarioMensal">Salário mensal (R$)</Label>
          <Input
            id="salarioMensal"
            name="salarioMensal"
            type="number"
            step="0.01"
            min="0"
            value={salarioMensal}
            onChange={(e) => setSalarioMensal(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="encargosPercent">Encargos sociais (%)</Label>
          <Input
            id="encargosPercent"
            name="encargosPercent"
            type="number"
            step="0.0001"
            min="0"
            value={encargosPercent}
            onChange={(e) => setEncargosPercent(e.target.value)}
            required
          />
        </div>

        {custoVisivel && (
          <p className="col-span-2 text-xs text-muted-foreground">
            Custo desta pessoa: {formatarMoeda(custoMensalMaoObra(custo))}/mês ·{" "}
            {formatarMoeda(custoDiarioMaoObra(custo, diasUteisMes))}/dia ({diasUteisMes} dias
            úteis)
          </p>
        )}

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="telefone">WhatsApp</Label>
          <CampoTelefone id="telefone" name="telefone" defaultValue={funcionario?.telefone} />
          <p className="text-xs text-muted-foreground">
            É por aqui que a pessoa recebe o aviso quando é o motorista do dia. Sem número,
            ela não pode ser salva como motorista de uma linha com veículo.
          </p>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              name="recebeProgramacao"
              defaultChecked={funcionario?.recebeProgramacao ?? true}
            />
            Recebe aviso de programação
          </Label>
          <p className="text-xs text-muted-foreground">
            Desligar tira a pessoa do envio em qualquer papel — inclusive como motorista
            retirado de uma programação.
          </p>
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <Checkbox id="ativo" name="ativo" defaultChecked={funcionario?.ativo ?? true} />
          <Label htmlFor="ativo" className="font-normal">Ativo</Label>
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar funcionário"}
        </Button>
      </div>
    </form>
  );
}
