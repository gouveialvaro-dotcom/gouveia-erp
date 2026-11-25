"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  alternarUnidade,
  atualizarUnidade,
  criarUnidade,
  excluirUnidade,
  type EstadoFormUnidade,
} from "@/app/(app)/cadastros/unidades-medida/actions";
import { cn } from "@/lib/utils";
import { COLUNAS_UNIDADE } from "@/components/cadastros/colunas-unidade";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UnidadeLinha = {
  id: string;
  sigla: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  usos: number;
};

export function UnidadeLinhaForm({ unidade }: { unidade: UnidadeLinha }) {
  const salvar = atualizarUnidade.bind(null, unidade.id);
  const [estado, formAction, pendente] = useActionState<EstadoFormUnidade, FormData>(salvar, undefined);
  const usada = unidade.usos > 0;

  return (
    <form
      action={formAction}
      className={cn("grid gap-3 px-3 py-2 items-center", COLUNAS_UNIDADE, !unidade.ativo && "opacity-50")}
    >
      {usada ? (
        // Sigla já gravada em requisições: fica fixa (o campo oculto mantém o valor).
        <>
          <input type="hidden" name="sigla" value={unidade.sigla} />
          <span className="px-1 font-mono text-sm font-medium" title="Já usada em requisições">
            {unidade.sigla}
          </span>
        </>
      ) : (
        <Input name="sigla" defaultValue={unidade.sigla} required aria-label="Sigla" className="font-mono uppercase" />
      )}
      <Input name="nome" defaultValue={unidade.nome} required aria-label="Nome" />
      <Input name="ordem" type="number" min="0" defaultValue={unidade.ordem} aria-label="Ordem" />
      <span className="text-sm text-muted-foreground md:text-right">
        <span className="md:hidden">Itens: </span>
        {unidade.usos}
      </span>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {estado?.erro && <span className="w-full text-right text-xs text-destructive">{estado.erro}</span>}
        <Button type="submit" variant="outline" size="sm" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
        {/* <button> nativo: só ele aceita formAction com uma Server Action. */}
        <button
          type="submit"
          formAction={alternarUnidade.bind(null, unidade.id, unidade.ativo)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {unidade.ativo ? "Desativar" : "Ativar"}
        </button>
        <BotaoExcluir
          acao={excluirUnidade}
          campos={{ unidadeId: unidade.id }}
          variant="ghost"
          titulo={`Excluir "${unidade.sigla}"?`}
          descricao={
            <>
              A unidade some do cadastro, sem volta. Se já houver item de requisição com ela, a exclusão é
              recusada — nesse caso use Desativar, que a tira da lista da requisição.
            </>
          }
        />
      </div>
    </form>
  );
}

export function NovaUnidadeForm() {
  const [estado, formAction, pendente] = useActionState<EstadoFormUnidade, FormData>(criarUnidade, undefined);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={formAction} className="grid max-w-3xl items-end gap-3 md:grid-cols-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sigla">Sigla</Label>
        <Input id="sigla" name="sigla" placeholder="Ex.: CX" required className="font-mono uppercase" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-4">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" placeholder="Ex.: Caixa" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ordem">Ordem</Label>
        <Input id="ordem" name="ordem" type="number" min="0" defaultValue="100" />
      </div>
      <div className="md:col-span-6">
        <Button type="submit" variant="secondary" disabled={pendente}>
          {pendente ? "Salvando..." : "+ Cadastrar unidade"}
        </Button>
      </div>
      {estado?.erro && <p className="text-sm text-destructive md:col-span-6">{estado.erro}</p>}
    </form>
  );
}
