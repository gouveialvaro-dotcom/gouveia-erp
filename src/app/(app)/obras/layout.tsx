import { exigirModuloVisivel } from "@/lib/modulos-visiveis";

// Só a restrição de módulos por usuário (Administração). A permissão por perfil
// continua em cada página e Server Action.
export default async function LayoutObras({ children }: { children: React.ReactNode }) {
  await exigirModuloVisivel("obras");
  return children;
}
