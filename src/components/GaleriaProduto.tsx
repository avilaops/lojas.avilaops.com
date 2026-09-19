"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

/**
 * O que a vitrine diz quando a imagem não é do próprio item.
 *
 * Foto de família é aceitável em catálogo técnico (todo rolamento 6200 se
 * parece), mas só com o aviso: a peça da foto pode ter blindagem, vedação ou
 * marca diferentes da que vai na caixa. Sem dizer isso, a economia de
 * fotografia vira devolução.
 */
const AVISO: Record<string, string> = {
  representativa: "Imagem representativa da série. Confira as medidas e especificações deste produto.",
  ilustracao: "Ilustração técnica gerada a partir das medidas cadastradas, não é foto do produto.",
};

/** Ampliação por toque e teclado; dialog nativo mantém foco e fecha com Escape. */
export default function GaleriaProduto({ imagens, alt, origem = "propria" }: { imagens: string[]; alt: string; origem?: string }) {
  const aviso = imagens.length > 0 ? AVISO[origem] : undefined;
  const [atual, setAtual] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const mudar = (passo: number) => {
    if (imagens.length) setAtual(i => (i + passo + imagens.length) % imagens.length);
  };
  const principal = imagens[atual];
  const grande = principal && /\/uploads\//.test(principal) && !/\.svg$/i.test(principal) ? `${principal}?w=1200` : principal;

  return (
    <div className="galeria-produto grid content-start gap-3 min-w-0">
      <button
        type="button"
        className="galeria-produto-principal relative aspect-square overflow-hidden rounded-xl border border-border bg-white"
        disabled={!grande}
        aria-label={`Ampliar foto de ${alt}`}
        onClick={() => dialog.current?.showModal()}
      >
        {grande ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={grande}
            alt={alt}
            className="h-full w-full object-contain p-5"
            fetchPriority="high"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Imagem em preparação</div>
        )}
        {grande && <span className="galeria-ampliar"><Expand size={16} aria-hidden="true" /> Ampliar foto</span>}
      </button>
      {aviso && <p className="text-xs leading-snug text-muted-foreground">{aviso}</p>}
      {imagens.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Fotos do produto">
          {imagens.map((img, i) => (
            <button key={`${img}-${i}`} type="button" onClick={() => setAtual(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${i === atual ? "border-primary" : "border-border"}`} aria-label={`Ver foto ${i + 1}`} aria-pressed={i === atual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={/\/uploads\//.test(img) && !/\.svg$/i.test(img) ? `${img}?w=160` : img} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
      <dialog ref={dialog} className="galeria-dialog" aria-label={`Fotos de ${alt}`} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }} onKeyDown={e => {
        if (e.key === "ArrowRight") { e.preventDefault(); mudar(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); mudar(-1); }
      }}>
        <div className="galeria-dialog-topo"><p>{alt}</p><button type="button" aria-label="Fechar foto ampliada" onClick={() => dialog.current?.close()}><X /></button></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {grande && <img src={grande} alt={`${alt} — foto ${atual + 1}`} className="galeria-dialog-foto" />}
        {imagens.length > 1 && <div className="galeria-dialog-nav">
          <button type="button" aria-label="Foto anterior" onClick={() => mudar(-1)}><ChevronLeft /></button>
          <span aria-live="polite">{atual + 1} / {imagens.length}</span>
          <button type="button" aria-label="Próxima foto" onClick={() => mudar(1)}><ChevronRight /></button>
        </div>}
      </dialog>
    </div>
  );
}
