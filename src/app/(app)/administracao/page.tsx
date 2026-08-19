import { PlaceholderModulo } from "@/components/placeholder-modulo";

export default function PaginaAdministracao() {
  return (
    <PlaceholderModulo
      titulo="Administração"
      descricao="Gestão de usuários pela interface — planejado para a Fase 2. Por enquanto, usuários são criados via seed no banco."
      modulos={["administracao"]}
    />
  );
}
