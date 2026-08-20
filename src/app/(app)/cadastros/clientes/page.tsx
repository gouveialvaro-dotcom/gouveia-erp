import { redirect } from "next/navigation";

// A lista de clientes é sempre por ramo — energia solar e redes/subestações
// têm cadastros diferentes.
export default async function PaginaClientes() {
  redirect("/cadastros/clientes/solar");
}
