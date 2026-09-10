import type { SVGProps } from "react";

type Desenho = "rolamento" | "vedacao" | "correia" | "ferramenta" | "mangueira" | "generico";

function desenhoDaCategoria(slug: string): Desenho {
  if (/rolamento|mancal|bucha/.test(slug)) return "rolamento";
  if (/retentor|anel|gaxeta|raspador|vedacao/.test(slug)) return "vedacao";
  if (/correia|corrente|polia/.test(slug)) return "correia";
  if (/ferramenta|broca|serra|alicate|disco|soquete/.test(slug)) return "ferramenta";
  if (/mangueira|hidraulica/.test(slug)) return "mangueira";
  return "generico";
}

/**
 * Pictogramas próprios para famílias técnicas. São vetoriais, leves e usam as
 * cores do tenant; assim uma categoria sem fotografia continua reconhecível
 * sem recorrer à inicial genérica ou a uma imagem que pode não ser do item.
 */
export default function IconeCategoria({ slug, ...props }: { slug: string } & SVGProps<SVGSVGElement>) {
  const desenho = desenhoDaCategoria(slug);
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <circle cx="32" cy="32" r="29" fill="currentColor" opacity=".08" />
      {desenho === "rolamento" && (
        <>
          <circle cx="32" cy="32" r="19" stroke="currentColor" strokeWidth="4" />
          <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="4" />
          {[0, 60, 120, 180, 240, 300].map((grau) => (
            <circle key={grau} cx="32" cy="17" r="2.6" fill="currentColor" transform={`rotate(${grau} 32 32)`} />
          ))}
        </>
      )}
      {desenho === "vedacao" && (
        <>
          <circle cx="32" cy="32" r="19" stroke="currentColor" strokeWidth="6" />
          <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="2" opacity=".55" />
          <path d="M19 20c7-7 20-8 28 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {desenho === "correia" && (
        <>
          <path d="M18 45 25 17h14l7 28H18Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
          <path d="m22 38 20-14M20 45l24-17" stroke="currentColor" strokeWidth="2" opacity=".55" />
        </>
      )}
      {desenho === "ferramenta" && (
        <path d="M39 15a12 12 0 0 0-12 15L15 42a5 5 0 0 0 7 7l12-12a12 12 0 0 0 15-12l-8 7-8-2-2-8 8-7Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      )}
      {desenho === "mangueira" && (
        <path d="M18 18v16a12 12 0 0 0 24 0v-4M13 18h10M37 18h10v12H37z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {desenho === "generico" && (
        <>
          <path d="m16 25 16-9 16 9v18l-16 9-16-9V25Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="m17 25 15 9 15-9M32 34v17" stroke="currentColor" strokeWidth="2.5" opacity=".6" />
        </>
      )}
    </svg>
  );
}
