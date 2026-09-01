"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { alterarMinhaSenha, type EstadoSenha } from "@/app/(app)/administracao/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// O caminho de troca de senha que todo perfil enxerga. Diferente do reset do
// administrador, este exige a senha atual: é a única prova de que quem está
// digitando é o dono da conta, e não alguém que sentou na máquina destravada.
export function MinhaSenhaCard({ email }: { email: string }) {
  const [estado, formAction, pendente] = useActionState<EstadoSenha, FormData>(
    alterarMinhaSenha,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Os campos são não controlados; sem limpar na volta, a senha antiga e a
  // nova ficam no formulário depois de trocadas.
  useEffect(() => {
    if (estado?.ok) {
      formRef.current?.reset();
      toast.success("Senha alterada.");
    }
  }, [estado]);

  return (
    <div className="rounded-md border bg-card p-4">
      <p className="font-medium">Minha senha</p>
      <p className="text-sm text-muted-foreground mb-3">
        Senha de acesso de <strong>{email}</strong>. Vale a partir do próximo login —
        sessões já abertas continuam de pé.
      </p>

      <form
        ref={formRef}
        action={formAction}
        className="grid gap-3 sm:grid-cols-3 max-w-3xl items-end"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="senhaAtual">Senha atual</Label>
          <Input
            id="senhaAtual"
            name="senhaAtual"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="novaSenha">Nova senha</Label>
          <Input
            id="novaSenha"
            name="novaSenha"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmacao">Repetir a nova senha</Label>
          <Input
            id="confirmacao"
            name="confirmacao"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pendente}>
            {pendente ? "Alterando..." : "Alterar senha"}
          </Button>
          <span className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</span>
          {estado?.erro && <span className="text-sm text-destructive">{estado.erro}</span>}
        </div>
      </form>
    </div>
  );
}
