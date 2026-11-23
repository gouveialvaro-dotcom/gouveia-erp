import { redirect } from "next/navigation";
import { cadastrosAtuais } from "@/lib/modulos-visiveis";

// Abre a primeira aba que a pessoa vê.
export default async function PaginaCadastros() {
  const visiveis = await cadastrosAtuais();
  redirect(visiveis[0]?.abas[0]?.href ?? "/");
}
