"use client";

import Image from "next/image";
import { useState } from "react";

/** Os oito layouts de `LAYOUTS` em src/lib/tema.ts, na ordem em que o painel oferece. */
type Modelo = "classico" | "vitrine" | "editorial" | "minimal" | "spotlight" | "mercado" | "distribuidora" | "automotivo" | "conversao";

const MODELOS: Array<{ id: Modelo; nome: string; resumo: string }> = [
  { id: "classico", nome: "Clássico", resumo: "Banner, categorias e destaques. Funciona para qualquer catálogo." },
  { id: "vitrine", nome: "Vitrine", resumo: "Imagem, variedade e conversão em primeiro plano." },
  { id: "editorial", nome: "Editorial", resumo: "Narrativa, curadoria e construção de marca." },
  { id: "minimal", nome: "Minimal", resumo: "Produtos fortes, catálogo enxuto e muito respiro." },
  { id: "spotlight", nome: "Spotlight", resumo: "Um produto principal em destaque e navegação visual." },
  { id: "mercado", nome: "Mercado", resumo: "Catálogo denso, departamentos e mais produtos por tela." },
  { id: "distribuidora", nome: "Distribuidora", resumo: "O catálogo denso com a sua imagem de banner na abertura." },
  { id: "automotivo", nome: "Automotivo", resumo: "O catálogo na ordem do serviço: lavar, corrigir, proteger." },
  { id: "conversao", nome: "Conversão", resumo: "Oferta clara, benefícios e caminho curto até a compra." },
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
  if (variante === "minimal") {
    return (
      <div className="pl-mini-loja pl-mini-minimal" aria-label="Prévia do layout Minimal">
        <div className="pl-mini-topo"><i /><span>FORMA</span><b>•••</b></div>
        <div className="pl-mini-minimal-copy"><small>OBJETOS PARA VIVER MELHOR</small><strong>Menos ruído.<br />Mais significado.</strong></div>
        <div className="pl-mini-produtos pl-mini-galeria-minimal"><Image src="/media/modelo-minimal.webp" alt="Composição minimalista de autocuidado" fill sizes="(max-width: 700px) 90vw, 420px" /></div>
      </div>
    );
  }
  if (variante === "spotlight") {
    return (
      <div className="pl-mini-loja pl-mini-spotlight" aria-label="Prévia do layout Spotlight">
        <div className="pl-mini-topo"><i /><span>CAPACETES RP</span><b>•••</b></div>
        <div className="pl-mini-spot">
          <div><small>LANÇAMENTO</small><strong>LS2 FF358<br />Blade Preto</strong><em>Comprar por R$ 599</em></div>
          <span className="pl-mini-spot-produto" aria-hidden="true"><i /></span>
        </div>
        <div className="pl-mini-chips" aria-hidden="true"><span /><span /><span /><span /></div>
      </div>
    );
  }
  if (variante === "mercado") {
    return (
      <div className="pl-mini-loja pl-mini-mercado" aria-label="Prévia do layout Mercado">
        <div className="pl-mini-topo"><i /><span>DISTRIBUIDORA SUL</span><b>•••</b></div>
        <div className="pl-mini-departamentos" aria-hidden="true"><span>Pneus</span><span>Óleo</span><span>Freios</span><span>Relação</span><span>Elétrica</span></div>
        <div className="pl-mini-mercado-grid" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => <span key={i}><i /><b /><small /></span>)}
        </div>
      </div>
    );
  }
  if (variante === "distribuidora") {
    return (
      <div className="pl-mini-loja pl-mini-mercado pl-mini-distribuidora" aria-label="Prévia do layout Distribuidora">
        <div className="pl-mini-topo"><i /><span>DISTRIBUIDORA SUL</span><b>•••</b></div>
        <div className="pl-mini-distribuidora-banner" aria-hidden="true"><strong>A peça certa,<br />no prazo certo.</strong></div>
        <div className="pl-mini-departamentos" aria-hidden="true"><span>Pneus</span><span>Óleo</span><span>Freios</span><span>Relação</span><span>Elétrica</span></div>
        <div className="pl-mini-mercado-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => <span key={i}><i /><b /><small /></span>)}
        </div>
      </div>
    );
  }
  if (variante === "automotivo") {
    return (
      <div className="pl-mini-loja pl-mini-mercado pl-mini-automotivo" aria-label="Prévia do layout Automotivo">
        <div className="pl-mini-topo"><i /><span>ESTÉTICA AUTOMOTIVA</span><b>•••</b></div>
        {/* A prévia mostra a trilha numerada, que é o que distingue este
            modelo dos outros na hora de escolher. */}
        <div className="pl-mini-trilha" aria-hidden="true">
          {["Lavar", "Corrigir", "Proteger"].map((etapa, i) => (
            <span key={etapa}><i>{i + 1}</i><b>{etapa}</b></span>
          ))}
        </div>
        <div className="pl-mini-mercado-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => <span key={i}><i /><b /><small /></span>)}
        </div>
      </div>
    );
  }
  if (variante === "conversao") {
    return (
      <div className="pl-mini-loja pl-mini-conversao" aria-label="Prévia do layout Conversão">
        <div className="pl-mini-topo"><i /><span>KIT SEMANA</span><b>•••</b></div>
        <div className="pl-mini-oferta">
          <div>
            <small>OFERTA DA SEMANA</small>
            <strong>Kit de 3 por R$ 129</strong>
            <ul aria-hidden="true"><li>Frete grátis acima de R$ 150</li><li>Pix na hora</li><li>Troca em 7 dias</li></ul>
            <em>Quero o kit</em>
          </div>
          <span className="pl-mini-oferta-selo" aria-hidden="true">-20%</span>
        </div>
      </div>
    );
  }
  return (
    <div className="pl-mini-loja pl-mini-classico" aria-label="Prévia do layout Clássico">
      <div className="pl-mini-topo"><i /><span>EMPÓRIO CENTRAL</span><b>•••</b></div>
      <div className="pl-mini-banner pl-mini-banner-classico"><small>BEM-VINDO</small><strong>Tudo para a sua casa,<br />entrega em 2 dias.</strong></div>
      <div className="pl-mini-chips pl-mini-chips-claro" aria-hidden="true"><span /><span /><span /></div>
      <div className="pl-mini-produtos"><span /><span /><span /></div>
    </div>
  );
}

export default function ModelosInterativos() {
  const [ativo, setAtivo] = useState<Modelo>("classico");
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
