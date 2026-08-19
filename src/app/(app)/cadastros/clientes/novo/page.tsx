import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { ClienteForm } from "@/components/cadastros/cliente-form";

export default async function PaginaNovoCliente() {
  const { perfil } = await acessoModulo("clientes");
  if (!podeEscrever(perfil, "clientes")) redirect("/cadastros/clientes");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo cliente</h2>
      <p className="text-sm text-muted-foreground mb-4">Cadastro de cliente</p>
      <ClienteForm />
    </div>
  );
}
