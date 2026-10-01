import type { Metadata } from "next";
import Link from "next/link";

/**
 * Sem `metadata` própria, esta página herda o título padrão da loja: um
 * endereço errado devolve 404 com o mesmo `<title>` da home e, para quem lê a
 * aba, vira uma segunda home. O `noindex` já vinha do layout; o que faltava
 * era o título dizer o que a página é.
 */
export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="container-loja py-20 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O endereço não existe ou o produto saiu do catálogo.
      </p>
      <Link href="/" className="btn-primario mt-6">Voltar ao início</Link>
    </div>
  );
}
