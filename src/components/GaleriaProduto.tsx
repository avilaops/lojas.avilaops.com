"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { avisoDaImagem } from "@/lib/imagem-origem";

/**
 * Galeria: foto principal com zoom ao passar o mouse, miniaturas clicáveis e
 * ampliação por toque ou teclado.
 *
 * O zoom do mouse não existe no celular nem para quem navega pelo teclado, e
 * era o único jeito de ler o rótulo da embalagem. A foto principal agora é um
 * botão que abre um `<dialog>` nativo: ele prende o foco, fecha com Escape e
 * devolve o foco ao botão, sem biblioteca.
 */
export default function GaleriaProduto({ imagens, alt, origem = "propria" }: { imagens: string[]; alt: string; origem?: string }) {
  const aviso = avisoDaImagem(origem, imagens.length > 0);
  const [atual, setAtual] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mudar = (passo: number) => {
    if (imagens.length) setAtual((i) => (i + passo + imagens.length) % imagens.length);
  };
  const principal = imagens[atual];
  const grande = principal && /\/uploads\//.test(principal) && !/\.svg$/i.test(principal) ? `${principal}?w=1200` : principal;
  const colunas = [6, 5, 4, 3, 2].find((n) => imagens.length <= n || imagens.length % n !== 1) ?? Math.min(imagens.length, 6);

  return (
    <div className="galeria-produto grid gap-2">
      <button
        type="button"
        // Sem foto, a moldura vira uma faixa: um quadrado vazio do tamanho da
        // tela empurrava preço, disponibilidade e pedido para baixo da dobra.
        className={`galeria-produto-principal relative block w-full overflow-hidden rounded-xl bg-muted ${imagens.length ? "aspect-square" : "aspect-[5/1] md:aspect-[3/1]"}`}
        disabled={!grande}
        aria-label={grande ? `Ampliar foto de ${alt}` : undefined}
        aria-haspopup="dialog"
        onClick={() => { setZoom(null); dialog.current?.showModal(); }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onPointerLeave={() => setZoom(null)}
      >
        {grande ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={grande}
            alt={alt}
            className="h-full w-full object-contain transition-transform duration-200"
            style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem foto do produto</span>
        )}
        {grande && <span className="galeria-ampliar" aria-hidden="true"><Expand size={16} /> Ampliar</span>}
      </button>
      {aviso && <p className="text-xs leading-snug text-muted-foreground">{aviso}</p>}
      {imagens.length > 1 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
          {imagens.slice(0, 20).map((img, i) => (
            <button key={img} type="button" onClick={() => setAtual(i)} className={`aspect-square overflow-hidden rounded-lg border-2 ${i === atual ? "border-primary" : "border-transparent"}`} aria-label={`Ver foto ${i + 1}`} aria-pressed={i === atual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={/\/uploads\//.test(img) && !/\.svg$/i.test(img) ? `${img}?w=160` : img} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {grande && (
        <dialog
          ref={dialog}
          className="galeria-dialog"
          aria-label={`Fotos de ${alt}`}
          // Toque fora da caixa (no fundo escuro) fecha, como em qualquer loja.
          onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); mudar(1); }
            if (e.key === "ArrowLeft") { e.preventDefault(); mudar(-1); }
          }}
        >
          <div className="galeria-dialog-topo">
            <p>{alt}</p>
            <button type="button" aria-label="Fechar foto ampliada" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={grande} alt={imagens.length > 1 ? `${alt}, foto ${atual + 1}` : alt} className="galeria-dialog-foto" />
          {imagens.length > 1 && (
            <div className="galeria-dialog-nav">
              <button type="button" aria-label="Foto anterior" onClick={() => mudar(-1)}><ChevronLeft aria-hidden="true" /></button>
              <span aria-live="polite">{atual + 1} / {imagens.length}</span>
              <button type="button" aria-label="Próxima foto" onClick={() => mudar(1)}><ChevronRight aria-hidden="true" /></button>
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
