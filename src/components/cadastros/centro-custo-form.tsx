"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  alternarCentroCusto,
  atualizarCentroCusto,
  criarCentroCusto,
  excluirCentroCusto,
  type EstadoFormCentroCusto,
} from "@/app/(app)/cadastros/centros-custo/actions";
import { cn } from "@/lib/utils";
import { COLUNAS_CENTRO_CUSTO } from "@/components/cadastros/colunas-centro-custo";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export type CentroCustoLinha = {
  id: string;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  ativo: boolean;
  requisicoes: number;
};

export function CentroCustoLinhaForm({ centro }: { centro: CentroCustoLinha }) {
  const salvar = atualizarCentroCusto.bind(null, centro.id);
  const [estado, formAction, pendente] = useActionState<EstadoFormCentroCusto, FormData>(salvar, undefined);

  return (
    <form
      action={formAction}
      className={cn("grid gap-3 px-3 py-2 items-center", COLUNAS_CENTRO_CUSTO, !centro.ativo && "opacity-50")}
    >
      <Input name="nome" defaultValue={centro.nome} required aria-label="Nome" />
      <Input name="codigo" defaultValue={centro.codigo ?? ""} aria-label="Código" placeholder="—" />
      <Input name="descricao" defaultValue={centro.descricao ?? ""} aria-label="Descrição" placeholder="—" />
      <span className="text-sm text-muted-foreground md:text-right">
        <span className="md:hidden">Requisições: </span>
        {centro.requisicoes}
      </span>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {estado?.erro && <span className="w-full text-right text-xs text-destructive">{estado.erro}</span>}
        <Button type="submit" variant="outline" size="sm" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
        {/* <button> nativo: só ele aceita formAction com uma Server Action. */}
        <button
          type="submit"
          formAction={alternarCentroCusto.bind(null, centro.id, centro.ativo)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {centro.ativo ? "Desativar" : "Ativar"}
        </button>
        <BotaoExcluir
          acao={excluirCentroCusto}
          campos={{ centroId: centro.id }}
          variant="ghost"
          titulo={`Excluir "${centro.nome}"?`}
          descricao={
            <>
              O centro de custo some do cadastro, sem volta. Se já houver requisição para ele, a
              exclusão é recusada — nesse caso use Desativar, que o tira da lista da requisição e
              preserva o histórico.
            </>
          }
        />
      </div>
    </form>
  );
}

export function NovoCentroCustoForm() {
  const [estado, formAction, pendente] = useActionState<EstadoFormCentroCusto, FormData>(
    criarCentroCusto,
    undefined
  );
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={formAction} className="grid max-w-3xl items-end gap-3 md:grid-cols-6">
      <div className="flex flex-col gap-1.5 md:col-span-3">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" placeholder="Ex.: Obra Usina Smartfit, Administrativo" required />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-1">
        <Label htmlFor="codigo">Código (opcional)</Label>
        <Input id="codigo" name="codigo" placeholder="Ex.: 1.02" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Input id="descricao" name="descricao" />
      </div>
      <div className="md:col-span-6">
        <Button type="submit" variant="secondary" disabled={pendente}>
          {pendente ? "Salvando..." : "+ Cadastrar centro de custo"}
        </Button>
      </div>
      {estado?.erro && <p className="text-sm text-destructive md:col-span-6">{estado.erro}</p>}
    </form>
  );
}
