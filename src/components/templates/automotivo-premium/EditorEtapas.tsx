"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { TemaLoja } from "@/lib/tema";
import { Campo, inputClasse } from "@/components/painel/campos";
import IconeCuidado from "./IconeCuidado";

type Etapas = NonNullable<NonNullable<TemaLoja["premium"]>["etapas"]>;
const ICONES = ["lavagem", "polimento", "protecao", "vitrificacao", "acessorios", "kits", "moto"] as const;
export default function EditorEtapas({ etapas, categorias, aoAlterar }: { etapas: Etapas; categorias: {slug:string; nome:string}[]; aoAlterar: (etapas: Etapas) => void }) {
  const livre = categorias.find(c => !etapas.some(e => e.categoria === c.slug));
  const mudar = (i:number, campo: Partial<Etapas[number]>) => aoAlterar(etapas.map((e,n) => n === i ? {...e,...campo} : e));
  function mover(i:number, d:number) { const novas=[...etapas]; [novas[i],novas[i+d]]=[novas[i+d],novas[i]]; aoAlterar(novas); }
  return <div className="col-span-full grid gap-4">
    <div><h3 className="font-semibold">Navegação por necessidade</h3><p className="text-sm text-muted-foreground">Organize até oito etapas. Cada uma abre uma categoria real do catálogo.</p></div>
    {etapas.map((e,i) => <fieldset key={e.categoria} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
      <legend className="text-sm font-medium">Etapa {i+1}</legend>
      <Campo label="Categoria"><select className={inputClasse} value={e.categoria} onChange={ev => mudar(i,{categoria:ev.target.value})}>{categorias.filter(c => c.slug===e.categoria || !etapas.some(x=>x.categoria===c.slug)).map(c=><option key={c.slug} value={c.slug}>{c.nome}</option>)}</select></Campo>
      <Campo label="Título"><input className={inputClasse} maxLength={60} value={e.titulo} onChange={ev=>mudar(i,{titulo:ev.target.value})}/></Campo>
      <Campo label="Descrição"><input className={inputClasse} maxLength={180} value={e.texto} onChange={ev=>mudar(i,{texto:ev.target.value})}/></Campo>
      <Campo label="Ícone"><div className="flex items-center gap-3"><IconeCuidado tipo={e.icone}/><select className={inputClasse} value={e.icone} onChange={ev=>mudar(i,{icone:ev.target.value as Etapas[number]["icone"]})}>{ICONES.map(v=><option key={v} value={v}>{v}</option>)}</select></div></Campo>
      <div className="col-span-full flex gap-2"><button type="button" className="btn-secundario" aria-label={`Subir etapa ${i+1}`} disabled={i===0} onClick={()=>mover(i,-1)}><ArrowUp size={16}/></button><button type="button" className="btn-secundario" aria-label={`Descer etapa ${i+1}`} disabled={i===etapas.length-1} onClick={()=>mover(i,1)}><ArrowDown size={16}/></button><button type="button" className="btn-secundario" onClick={()=>aoAlterar(etapas.filter((_,n)=>n!==i))}><Trash2 size={16}/> Remover etapa {i+1}</button></div>
    </fieldset>)}
    <button type="button" className="btn-secundario w-fit" disabled={!livre || etapas.length>=8} onClick={()=>{ if(livre) aoAlterar([...etapas,{categoria:livre.slug,titulo:livre.nome,texto:"",icone:"lavagem"}]); }}>Adicionar etapa</button>
  </div>;
}
