/**
 * "Últimas unidades" — só aparece quando é verdade.
 *
 * Escassez inventada é o truque mais comum e mais corrosivo do e-commerce
 * pequeno: aqui o número vem do estoque real, e some quando o lojista repõe.
 */
export default function EstoqueBaixo({ estoque, limite }: { estoque: number | null; limite: number }) {
  if (limite <= 0 || estoque == null || estoque <= 0 || estoque > limite) return null;
  return (
    <p className="selo-estoque-baixo">
      {estoque === 1 ? "Última unidade em estoque" : `Últimas ${estoque} unidades em estoque`}
    </p>
  );
}
