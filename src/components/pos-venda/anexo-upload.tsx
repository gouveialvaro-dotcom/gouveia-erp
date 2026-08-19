"use client";

import { useActionState, useRef } from "react";
import { enviarAnexo, type EstadoAnexo } from "@/app/(app)/pos-venda/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AnexoUpload({ chamadoId }: { chamadoId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const enviarComId = enviarAnexo.bind(null, chamadoId);
  const [estado, formAction, pendente] = useActionState<EstadoAnexo, FormData>(
    enviarComId,
    undefined
  );

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2 max-w-3xl"
    >
      <div className="flex gap-2 items-center">
        <Input
          name="arquivo"
          type="file"
          required
          accept="image/*,application/pdf,.xlsx,.xls,.csv"
          className="h-auto py-1.5"
        />
        <Button type="submit" variant="secondary" disabled={pendente}>
          {pendente ? "Enviando..." : "+ Anexar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Print de fatura, relatório de geração ou protocolo — até 10MB por arquivo.
      </p>
      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}
