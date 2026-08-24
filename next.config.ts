import path from "node:path";
import type { NextConfig } from "next";

/**
 * Um servidor, N lojas.
 *
 * Diferente da Brilhax (export estático, um build por site), aqui o site é
 * servido dinamicamente: o `Host` da requisição decide qual loja renderizar.
 * Criar uma loja nova é uma linha no banco, não um build.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  // packages/checkout fica fora desta pasta; a raiz do bundler é o monorepo.
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
  // O pacote de checkout é consumido direto do fonte (.ts), sem build próprio.
  transpilePackages: ["@avilaops/checkout"],
  images: {
    // As fotos de produto vivem no nosso storage; qualquer outro host é
    // recusado para uma loja não conseguir apontar imagem para fora.
    remotePatterns: [{ protocol: "https", hostname: "**.avilaops.com" }],
  },
  poweredByHeader: false,
};

export default nextConfig;
