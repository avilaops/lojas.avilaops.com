/**
 * Marca Lojas em SVG em linha, a mesma de public/media/marca/*.svg.
 *
 * Fachada, porta e letras usam `currentColor`: a marca acompanha a tinta de
 * onde está (papel claro, cabeçalho escuro, rodapé de loja de cliente) sem
 * precisar de uma versão por fundo. As três faixas do toldo são fixas, salvo
 * no modo `mono`, que é o único permitido dentro de loja de cliente.
 */

const TOLDO = [
  { d: "M8 16a4 4 0 0 1 4-4h12v14a8 8 0 0 1-16 0Z", cor: "#0153FD" },
  { d: "M24 12h16v14a8 8 0 0 1-16 0Z", cor: "#F72927" },
  { d: "M40 12h12a4 4 0 0 1 4 4v10a8 8 0 0 1-16 0Z", cor: "#FDC403" },
];

// No monocromático as faixas ganham respiro entre si, senão o toldo vira um bloco.
const TOLDO_MONO = [
  "M8 16a4 4 0 0 1 4-4h11v14a7.5 7.5 0 0 1-15 0Z",
  "M25 12h14v14a7 7 0 0 1-14 0Z",
  "M41 12h11a4 4 0 0 1 4 4v10a7.5 7.5 0 0 1-15 0Z",
];

function Fachada({ mono }: { mono: boolean }) {
  return (
    <g transform="translate(0 -3.5)">
      {mono
        ? TOLDO_MONO.map((d) => <path key={d} d={d} fill="currentColor" />)
        : TOLDO.map((f) => <path key={f.d} d={f.d} fill={f.cor} />)}
      <path d="M14 40v13a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3V40" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 56V45a7 7 0 0 1 14 0v11Z" fill="currentColor" />
    </g>
  );
}

function Palavra({ mono }: { mono: boolean }) {
  return (
    <>
      <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9v28" />
        <circle cx="22" cy="28" r="9" />
        <path d="M41 19v23a8 8 0 0 1-8 8" />
        <circle cx="60" cy="28" r="9" />
        <path d="M69 19v18" />
        <path d="M91 19h-7a4.5 4.5 0 0 0 0 9h2a4.5 4.5 0 0 1 0 9h-7" />
      </g>
      <circle cx="41" cy="8" r="4" fill={mono ? "currentColor" : "#F72927"} />
    </>
  );
}

type Props = { className?: string; mono?: boolean; titulo?: string };

/** Só o símbolo (a fachada com toldo). Decorativo quando não recebe `titulo`. */
export function SimboloLojas({ className, mono = false, titulo }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true} focusable="false">
      <Fachada mono={mono} />
    </svg>
  );
}

/** Símbolo + "lojas". A altura manda; a largura sai da proporção (170 × 64). */
export function LogoLojas({ className, mono = false, titulo = "Lojas" }: Props) {
  return (
    <svg viewBox="4 6 170 64" className={className} role="img" aria-label={titulo} focusable="false">
      <Fachada mono={mono} />
      <g transform="translate(76 15)">
        <Palavra mono={mono} />
      </g>
    </svg>
  );
}

/**
 * Assinatura da plataforma: logo com o endosso "por Avila Ops" em texto, que
 * continua selecionável e legível por leitor de tela. `compacta` tira o endosso.
 */
export default function MarcaLojas({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className="pl-marca">
      <LogoLojas className="pl-marca-logo" titulo="Lojas" />
      {!compacta && <small className="pl-marca-endosso">por Avila Ops</small>}
    </span>
  );
}
