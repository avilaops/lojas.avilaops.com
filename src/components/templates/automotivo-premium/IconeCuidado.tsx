import type { SVGProps } from "react";

/** Pictogramas vetoriais do template: mesmo traço, grade 24 e sem bitmaps. */
export default function IconeCuidado({ tipo, ...props }: SVGProps<SVGSVGElement> & { tipo: string }) {
  const desenhos: Record<string, React.ReactNode> = {
    lavagem: <><path d="M7 4c0 3-4 5-4 8a4 4 0 0 0 8 0c0-3-4-5-4-8Z"/><path d="M16 3v4m-2-2h4m-1 7v6m-3-3h6M4 21h16"/></>,
    polimento: <><circle cx="13" cy="14" r="6"/><circle cx="13" cy="14" r="2"/><path d="m8 10-4-4 3-3 5 5M18 18l3 3"/></>,
    protecao: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    vitrificacao: <><path d="m12 2 9 10-9 10-9-10 9-10Zm-9 10h18M12 2 8 12l4 10 4-10-4-10Z"/></>,
    acessorios: <><path d="M5 4h14v16H5zM5 8h14M9 8v12m6-12v12M2 12h3m14 0h3"/></>,
    kits: <><path d="m3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M8 5l9 4v5"/></>,
    moto: <><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m5 17 4-8h5l5 8M9 9l4 8H5m8 0 3-12h-4M4 9h5"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{desenhos[tipo] ?? desenhos.protecao}</svg>;
}
