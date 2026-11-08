"use client";

import { useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

export default function FaixaMarcas({ children }: { children: ReactNode }) {
  const [pausado, setPausado] = useState(false);
  return <div className="ap-marcas-faixa" data-pausado={pausado || undefined}>
    <div className="ap-marcas-janela"><div className="ap-marcas-movimento">{children}</div></div>
    <button type="button" className="ap-marcas-pausa" aria-label={pausado ? "Retomar movimento das marcas" : "Pausar movimento das marcas"} aria-pressed={pausado} onClick={() => setPausado(!pausado)}>{pausado ? <Play size={14} /> : <Pause size={14} />}</button>
  </div>;
}
