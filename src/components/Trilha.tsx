import Link from "@/components/LinkLoja";
import { ChevronRight } from "lucide-react";

/**
 * A trilha de onde a pessoa está (Início › Rolamento).
 *
 * Serve a duas coisas ao mesmo tempo: o comprador que entrou por um link do
 * Google não sabe onde caiu, e o próprio Google usa o `BreadcrumbList` para
 * mostrar o caminho no resultado da busca em vez da URL crua.
 *
 * O JSON-LD sai junto e a partir da mesma lista: dado estruturado que descreve
 * uma trilha diferente da que está na tela é o tipo de coisa que passa
 * despercebida por meses.
 */
export default function Trilha({
  itens,
  base,
}: {
  /** Do começo ao fim; o último é a página atual e não vira link. */
  itens: Array<{ nome: string; href?: string }>;
  /** Endereço da loja, para o JSON-LD levar URL absoluta. */
  base: string;
}) {
  if (itens.length === 0) return null;

  const todos = [{ nome: "Início", href: "/" }, ...itens];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: todos.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nome,
      ...(item.href ? { item: `${base}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Você está em" className="trilha">
        <ol>
          {todos.map((item, i) => {
            const ultimo = i === todos.length - 1;
            return (
              <li key={item.nome}>
                {i > 0 && <ChevronRight size={13} aria-hidden="true" />}
                {ultimo || !item.href ? (
                  <span aria-current={ultimo ? "page" : undefined}>{item.nome}</span>
                ) : (
                  <Link href={item.href}>{item.nome}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
