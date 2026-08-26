"use client";

import { useActionState, useEffect, useState } from "react";
import {
  trocarResponsavel,
  type EstadoTrocaResponsavel,
} from "@/app/(app)/pos-venda/actions";
import { Button } from "@/components/ui/button";
import { ComboboxCampo } from "@/components/ui/combobox-campo";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ResponsavelOpcao } from "./chamado-criar-form";

export function TrocarResponsavel({
  chamadoId,
  responsavelAtual,
  elegiveis,
}: {
  chamadoId: string;
  responsavelAtual: { id: string; nome: string };
  elegiveis: ResponsavelOpcao[];
}) {
  const [aberto, setAberto] = useState(false);

  // O dono atual sai da lista: não existe repassar para si mesmo, e a action
  // recusaria de qualquer forma.
  const opcoes = elegiveis.filter((u) => u.id !== responsavelAtual.id);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Repassar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repassar chamado</DialogTitle>
          <DialogDescription>
            Hoje o chamado é de <strong>{responsavelAtual.nome}</strong>. O chamado nunca
            fica sem dono — escolha para quem ele passa. A troca entra na linha do tempo e
            avisa quem entra, quem sai e a diretoria.
          </DialogDescription>
        </DialogHeader>
        {/* O formulário vive dentro do popup, que o Base UI desmonta ao fechar:
            assim o estado da action não sobrevive para a próxima abertura. */}
        <FormTroca chamadoId={chamadoId} opcoes={opcoes} aoTrocar={() => setAberto(false)} />
      </DialogContent>
    </Dialog>
  );
}

function FormTroca({
  chamadoId,
  opcoes,
  aoTrocar,
}: {
  chamadoId: string;
  opcoes: ResponsavelOpcao[];
  aoTrocar: () => void;
}) {
  const acao = trocarResponsavel.bind(null, chamadoId);
  const [estado, formAction, pendente] = useActionState<EstadoTrocaResponsavel, FormData>(
    acao,
    undefined
  );
  const [escolhido, setEscolhido] = useState("");

  // Fechar só no sucesso: na falha o diálogo continua aberto com a mensagem à
  // vista, senão o erro sumiria junto com o popup.
  useEffect(() => {
    if (estado?.ok) aoTrocar();
  }, [estado, aoTrocar]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="novoResponsavelId">Novo responsável</Label>
        <ComboboxCampo
          id="novoResponsavelId"
          name="responsavelId"
          itens={opcoes.map((u) => ({ value: u.id, label: `${u.nome} · ${u.perfil}` }))}
          placeholder="Buscar responsável..."
          textoVazio="Nenhum outro usuário elegível."
          aoSelecionar={(opcao) => setEscolhido(opcao?.value ?? "")}
        />
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pendente || !escolhido}>
          {pendente ? "Repassando..." : "Repassar chamado"}
        </Button>
        <Button type="button" variant="ghost" onClick={aoTrocar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
