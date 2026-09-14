"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Expand } from "lucide-react";

/** Galeria adaptada do Gallery Grid with Lightbox, moumensoliman / 21st (10596).
 * Dialog nativo acrescenta focus trap, Escape e retorno do foco; sem imagens
 * fictícias, filtros de portfólio ou animação obrigatória.
 */
export default function Galeria({ imagens, alt, origem = "propria" }: { imagens: string[]; alt: string; origem?: string }) {
  const [indice, setIndice] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const fotos = [...new Set(imagens)];
  const atual = fotos[Math.min(indice, fotos.length - 1)];
  const proxima = (delta: number) => setIndice(i => (i + delta + fotos.length) % fotos.length);
  const aviso = origem === "representativa" ? "Imagem representativa da série. Confira as especificações desta apresentação." : origem === "ilustracao" ? "Ilustração técnica, não é foto do produto." : null;
  return <div className="ap-galeria">
    <button className="ap-galeria-principal" disabled={!atual} onClick={() => dialog.current?.showModal()} aria-label={`Ampliar foto de ${alt}`}>
      {atual ? <Image unoptimized src={atual} alt={alt} width={900} height={900} loading="eager" fetchPriority="high"/> : <span>Imagem em preparação</span>}
      {atual && <span className="ap-ampliar"><Expand size={16}/> Ampliar</span>}
    </button>
    {fotos.length > 1 && <div className="ap-miniaturas" aria-label="Fotos do produto">{fotos.map((src,i) => <button key={src} onClick={() => setIndice(i)} aria-label={`Ver foto ${i + 1}`} aria-pressed={i === indice}><Image unoptimized src={src} alt="" width={80} height={80} loading="lazy"/></button>)}</div>}
    {aviso && <p className="ap-nota">{aviso}</p>}
    <dialog ref={dialog} className="ap-lightbox" aria-label={`Fotos de ${alt}`} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }} onKeyDown={e => { if(e.key === "ArrowRight") proxima(1); if(e.key === "ArrowLeft") proxima(-1); }}>
      <div className="ap-lightbox-topo"><p>{alt}</p><button className="ap-icone" aria-label="Fechar foto ampliada" onClick={() => dialog.current?.close()}><X/></button></div>
      <div className="ap-lightbox-foto">{atual && <Image unoptimized src={atual} alt={`${alt} — foto ${indice+1}`} width={1200} height={1200}/>}</div>
      {fotos.length > 1 && <div className="ap-lightbox-nav"><button className="ap-icone" aria-label="Foto anterior" onClick={() => proxima(-1)}><ChevronLeft/></button><span aria-live="polite">{indice+1} / {fotos.length}</span><button className="ap-icone" aria-label="Próxima foto" onClick={() => proxima(1)}><ChevronRight/></button></div>}
    </dialog>
  </div>;
}
