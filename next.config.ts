import type { NextConfig } from "next";
import createMDX from "@next/mdx";

/**
 * Um servidor, N lojas.
 *
 * Diferente da Brilhax (export estático, um build por site), aqui o site é
 * servido dinamicamente: o `Host` da requisição decide qual loja renderizar.
 * Criar uma loja nova é uma linha no banco, não um build.
 */
// Version skew: quando um deploy acontece com a aba aberta, os IDs de chunk e
// de Server Action mudam. O deploymentId faz o Next devolver 404 previsível
// nesses casos (em vez de erro silencioso) e o cliente recarrega; ver
// ErroDeVersao em src/app/layout.tsx.
const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  deploymentId: process.env.LOJAS_DEPLOY_ID || undefined,
  output: "standalone",
  // No CI o job de tipos (incluindo next typegen) precisa passar antes do build.
  // Builds comuns preservam a verificação interna do Next.
  typescript: { ignoreBuildErrors: process.env.CI === "true" && process.env.LOJAS_CI_TIPOS_VERIFICADOS === "1" },
  // O checkout acompanha o codigo da plataforma no mesmo repositorio.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  // O pacote de checkout é consumido direto do fonte (.ts), sem build próprio.
  transpilePackages: ["@avilaops/checkout", "@avilaops/gerador-3d"],
  // O Prisma tem binário nativo; carregado por nome em runtime, não empacotado
  // (sem isto o Turbopack gera um alias com hash que não existe no standalone).
  serverExternalPackages: ["@prisma/client", "onnxruntime-node", "sharp"],
  images: {
    // As fotos de produto vivem no nosso storage; qualquer outro host é
    // recusado para uma loja não conseguir apontar imagem para fora.
    remotePatterns: [{ protocol: "https", hostname: "**.avilaops.com" }],
  },
  poweredByHeader: false,
  // Endereço do catálogo em sites anteriores das lojas. O Google ainda manda
  // gente para `/loja` (277 impressões em 28 dias na Vedashow, em 10/2026) e
  // a página respondia 404; o catálogo daqui é `/produtos`.
  async redirects() {
    return [{ source: "/loja", destination: "/produtos", permanent: true }];
  },
};

export default createMDX()(nextConfig);
