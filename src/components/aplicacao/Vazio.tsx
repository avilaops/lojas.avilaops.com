import Link from "next/link";

/**
 * O que a tela mostra quando não há nada.
 *
 * Área vazia sem explicação faz o lojista achar que a loja quebrou. Aqui a
 * ausência vira instrução, com a ação que resolve.
 *
 * Distingue dois vazios diferentes: **não existe nada ainda** (e aí a ação é
 * criar) e **o filtro não achou** (e aí a ação é limpar o filtro). Tratar os
 * dois igual manda a pessoa cadastrar um produto que ela já tem.
 */
export default function Vazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto?: string;
  acao?: { rotulo: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="font-medium">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{texto}</p>}
      {acao && (
        <div className="mt-4">
          {acao.href ? (
            <Link href={acao.href} className="btn-primario inline-flex h-11 items-center px-5">{acao.rotulo}</Link>
          ) : (
            <button className="btn-primario inline-flex h-11 items-center px-5" onClick={acao.onClick}>{acao.rotulo}</button>
          )}
        </div>
      )}
    </div>
  );
}
