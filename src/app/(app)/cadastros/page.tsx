import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";

export default async function PaginaCadastros() {
  const { perfil } = await acessoModulo("clientes");
  redirect(podeLer(perfil, "clientes") ? "/cadastros/clientes" : "/cadastros/materiais");
}
