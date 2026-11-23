import { exigirModuloVisivel } from "@/lib/modulos-visiveis";

// Só a restrição de módulos por usuário (Administração). A permissão por perfil
// continua em cada página e Server Action.
export default async function LayoutCrm({ children }: { children: React.ReactNode }) {
  await exigirModuloVisivel("crm");
  return children;
}
