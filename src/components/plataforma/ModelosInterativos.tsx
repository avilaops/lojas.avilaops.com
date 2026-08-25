"use client";

import Image from "next/image";
import { useState } from "react";

type Modelo = "minimal" | "editorial" | "vitrine";

const MODELOS: Array<{ id: Modelo; nome: string; resumo: string }> = [
  { id: "minimal", nome: "Minimal", resumo: "Produtos fortes, catálogo enxuto e muito respiro." },
  { id: "editorial", nome: "Editorial", resumo: "Narrativa, curadoria e construção de marca." },
  { id: "vitrine", nome: "Vitrine", resumo: "Imagem, variedade e conversão em primeiro plano." },
];

function MiniLoja({ variante }: { variante: Modelo }) {
  if (variante === "editorial") {
    return (
      <div className="pl-mini-loja pl-mini-editorial" aria-label="Prévia do layout Editorial">
        <div className="pl-mini-topo"><i /><span>ATELIÊ</span><b>•••</b></div>
        <div className="pl-mini-editorial-grid">
          <div><small>NOVA COLEÇÃO</small><strong>Peças que contam histórias.</strong><em>Explorar coleção</em></div>
          <span className="pl-mini-foto pl-mini-foto-vaso"><Image src="/media/modelo-editorial.webp" alt="Composição editorial de decoração" fill sizes="(max-width: 700px) 90vw, 420px" /></span>
        </div>
      </div>
    );
  }
  if (variante === "vitrine") {
    return (
      <div className="pl-mini-loja pl-mini-vitrine" aria-label="Prévia do layout Vitrine">
        <div className="pl-mini-topo"><i /><span>NÓRDICA</span><b>•••</b></div>
        <div className="pl-mini-banner"><Image src="/media/modelo-vitrine.webp" alt="Composição de produtos para vitrine" fill sizes="(max-width: 700px) 90vw, 420px" /><small>ESSENCIAIS</small><strong>Forma, textura<br />e intenção.</strong></div>
        <div className="pl-mini-produtos"><span /><span /><span /></div>
      </div>
    );
  }
  return (
    <div className="pl-mini-loja pl-mini-minimal" aria-label="Prévia do layout Minimal">
      <div className="pl-mini-topo"><i /><span>FORMA</span><b>•••</b></div>
      <div className="pl-mini-minimal-copy"><small>OBJETOS PARA VIVER MELHOR</small><strong>Menos ruído.<br />Mais significado.</strong></div>
      <div className="pl-mini-produtos pl-mini-galeria-minimal"><Image src="/media/modelo-minimal.webp" alt="Composição minimalista de autocuidado" fill sizes="(max-width: 700px) 90vw, 420px" /></div>
    </div>
  );
}

export default function ModelosInterativos() {
  const [ativo, setAtivo] = useState<Modelo>("editorial");
  return (
    <div className="pl-modelos-experiencia">
      <div className="pl-modelos-seletor" role="tablist" aria-label="Escolha um layout para visualizar">
        {MODELOS.map((modelo) => (
          <button key={modelo.id} type="button" role="tab" aria-selected={ativo === modelo.id} onClick={() => setAtivo(modelo.id)}>
            <span>{modelo.nome}</span><small>{modelo.resumo}</small>
          </button>
        ))}
      </div>
      <div className="pl-modelos-palco">
        {MODELOS.map((modelo) => (
          <button key={modelo.id} type="button" onClick={() => setAtivo(modelo.id)} className={`pl-modelo ${ativo === modelo.id ? "ativo" : ""}`} aria-label={`Selecionar layout ${modelo.nome}`}>
            <MiniLoja variante={modelo.id} />
            <span><b>{modelo.nome}</b><small>{modelo.resumo}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
