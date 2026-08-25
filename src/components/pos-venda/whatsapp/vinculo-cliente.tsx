"use client";

import { useActionState, useState } from "react";
import { vincularCliente, type EstadoVinculo } from "@/app/(app)/pos-venda/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { ComboboxCampo, type OpcaoCombobox } from "@/components/ui/combobox-campo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export type ContatoOpcao = { id: string; clienteId: string; nome: string; telefone: string | null };

/**
 * Vincula manualmente a conversa a um cliente. É o tratamento da caixa
 * "Sem cliente": o número que não casou com nenhum cadastro fica esperando aqui
 * até alguém dizer de quem é. O vínculo persiste para o telefone — a próxima
 * mensagem do mesmo número já chega no cliente certo.
 */
export function VinculoCliente({
  conversaId,
  clientes,
  contatos,
  clienteAtual,
  nomePerfil,
}: {
  conversaId: string;
  clientes: OpcaoCombobox[];
  contatos: ContatoOpcao[];
  clienteAtual: OpcaoCombobox | null;
  nomePerfil: string | null;
}) {
  const [clienteId, setClienteId] = useState(clienteAtual?.value ?? "");
  const vincularComId = vincularCliente.bind(null, conversaId);
  const [estado, formAction, pendente] = useActionState<EstadoVinculo, FormData>(
    vincularComId,
    undefined
  );

  const contatosDoCliente = contatos.filter((c) => c.clienteId === clienteId);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clienteId">Cliente</Label>
        <ComboboxCampo
          id="clienteId"
          name="clienteId"
          itens={clientes}
          itemInicial={clienteAtual}
          placeholder="Buscar cliente"
          textoVazio="Nenhum cliente encontrado."
          aoSelecionar={(opcao) => setClienteId(opcao?.value ?? "")}
        />
      </div>

      {contatosDoCliente.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contatoClienteId">Contato (opcional)</Label>
          <SelectNativo id="contatoClienteId" name="contatoClienteId" defaultValue="">
            <option value="">Não identificar o contato</option>
            {contatosDoCliente.map((contato) => (
              <option key={contato.id} value={contato.id}>
                {contato.nome}
                {contato.telefone ? ` · ${contato.telefone}` : ""}
              </option>
            ))}
          </SelectNativo>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomeContato">Quem fala por este número</Label>
        <Input
          id="nomeContato"
          name="nomeContato"
          defaultValue={nomePerfil ?? ""}
          placeholder="Nome do contato"
        />
        <p className="text-xs text-muted-foreground">
          O telefone é gravado na ficha do cliente — não existe lista separada
          aqui. Se o cliente já tem telefone principal, este entra como contato.
        </p>
      </div>

      <Button type="submit" size="sm" variant="secondary" disabled={pendente}>
        {pendente ? "Vinculando..." : clienteAtual ? "Trocar cliente" : "Vincular cliente"}
      </Button>

      {clienteAtual && (
        <p className="text-xs text-muted-foreground">
          Trocar o cliente solta a marcação de chamado da conversa.
        </p>
      )}
      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}
