"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  redefinirSenhaUsuario,
  type EstadoSenha,
} from "@/app/(app)/administracao/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Saída para quem esqueceu a senha — antes só existia rodando `npm run seed`
// na máquina de alguém. O administrador define uma provisória e combina com a
// pessoa por fora; ela troca depois no cartão "Minha senha".
export function RedefinirSenhaDialog({
  usuarioId,
  nome,
  email,
}: {
  usuarioId: string;
  nome: string;
  email: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {/* type="button": o gatilho fica dentro do <form> da linha do usuário, e
          sem isso o clique salvaria perfil/situação em vez de abrir o popup. */}
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm">Senha</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha de {nome}</DialogTitle>
          <DialogDescription>
            A senha atual de <strong>{email}</strong> não é pedida — é para o caso de
            quem esqueceu. Passe a provisória para a pessoa por um canal seguro; ela
            troca depois em Administração.
          </DialogDescription>
        </DialogHeader>
        {/* O formulário vive dentro do popup, que o Base UI desmonta ao fechar:
            o estado da action some junto e o diálogo não reabre já fechando. */}
        <FormRedefinirSenha
          usuarioId={usuarioId}
          nome={nome}
          aoRedefinir={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormRedefinirSenha({
  usuarioId,
  nome,
  aoRedefinir,
}: {
  usuarioId: string;
  nome: string;
  aoRedefinir: () => void;
}) {
  const redefinir = redefinirSenhaUsuario.bind(null, usuarioId);
  const [estado, formAction, pendente] = useActionState<EstadoSenha, FormData>(
    redefinir,
    undefined
  );

  useEffect(() => {
    if (estado?.ok) {
      toast.success(`Senha de ${nome} redefinida.`);
      aoRedefinir();
    }
  }, [estado, nome, aoRedefinir]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="novaSenha">Senha provisória</Label>
        <Input
          id="novaSenha"
          name="novaSenha"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmacao">Repetir a senha</Label>
        <Input
          id="confirmacao"
          name="confirmacao"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <Button type="submit" disabled={pendente}>
        {pendente ? "Redefinindo..." : "Redefinir senha"}
      </Button>
    </form>
  );
}
