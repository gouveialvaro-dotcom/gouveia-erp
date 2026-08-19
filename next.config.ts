import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Anexos de chamado (print de fatura, relatório de geração) sobem por
      // Server Action. O padrão de 1MB derruba qualquer print de tela; o
      // bucket "pos-venda" no Supabase limita o arquivo em 10MB e a folga
      // extra aqui cobre o overhead do multipart.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
