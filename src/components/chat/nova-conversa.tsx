"use client";

import { useActionState, useState } from "react";
import { abrirConversaDireta, criarGrupo, type EstadoChat } from "@/app/(app)/chat/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Usuario = { id: string; nome: string };

export function NovaConversa({ usuarios }: { usuarios: Usuario[] }) {
  const [aba, setAba] = useState<"direta" | "grupo">("direta");
  const [estado, formAction, pendente] = useActionState<EstadoChat, FormData>(
    criarGrupo,
    undefined
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            + Nova conversa
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={aba === "direta" ? "default" : "ghost"}
            size="sm"
            onClick={() => setAba("direta")}
          >
            Direta
          </Button>
          <Button
            variant={aba === "grupo" ? "default" : "ghost"}
            size="sm"
            onClick={() => setAba("grupo")}
          >
            Grupo
          </Button>
        </div>

        {aba === "direta" ? (
          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {usuarios.map((u) => (
              <li key={u.id}>
                <form action={abrirConversaDireta.bind(null, u.id)}>
                  <Button type="submit" variant="ghost" className="w-full justify-start">
                    {u.nome}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">Nome do grupo</Label>
              <Input id="titulo" name="titulo" required />
            </div>
            <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
              {usuarios.map((u) => (
                <Label key={u.id} className="flex items-center gap-2 font-normal">
                  <Checkbox name="participantes" value={u.id} />
                  {u.nome}
                </Label>
              ))}
            </div>
            {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
            <Button type="submit" disabled={pendente}>
              {pendente ? "Criando..." : "Criar grupo"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
