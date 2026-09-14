"use client";
import { useEffect,useState } from "react";
import type { OcorrenciaCatalogo } from "@/lib/catalogo-qualidade";

type Diagnostico={ocorrencias:OcorrenciaCatalogo[];canais:{nome:string;canal:string;estadoEnvio:string;resultadoExterno:string;consultadoEm:string|null}[]};
export default function QualidadeProduto({produtoId,revisao,aoAbrirVariantes}:{produtoId:string;revisao:number;aoAbrirVariantes:()=>void}) {
  const [d,setD]=useState<Diagnostico|null>(null),[erro,setErro]=useState("");
  useEffect(()=>{const controller=new AbortController();fetch(`/api/painel/catalogo/qualidade?produtoId=${encodeURIComponent(produtoId)}`,{signal:controller.signal}).then(async r=>{if(!r.ok) throw new Error("Não foi possível conferir o catálogo.");return r.json();}).then(setD).catch(e=>{if(e.name!=="AbortError")setErro(e.message);});return()=>controller.abort();},[produtoId,revisao]);
  function corrigir(o:OcorrenciaCatalogo) {
    if(o.campo==="variantes") return aoAbrirVariantes();
    const campo=document.getElementById(`catalogo-${o.campo}`);
    if(campo instanceof HTMLInputElement && campo.readOnly) return aoAbrirVariantes();
    campo?.scrollIntoView({behavior:"smooth",block:"center"});campo?.focus();
  }
  return <section aria-label="Qualidade do catálogo" className="border-y border-border py-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">O que falta neste cadastro</h2><span className="text-xs text-muted-foreground">Conferência do Lojas</span></div>
    <p className="mt-1 text-sm text-muted-foreground">Dados bem preenchidos ajudam a publicar. A aprovação de cada canal depende da resposta dele.</p>
    {erro?<p role="alert">{erro}</p>:!d?<p className="mt-3 text-sm">Conferindo…</p>:<>
      {!d.ocorrencias.length?<p className="mt-4 text-sm text-emerald-700">Nenhuma pendência encontrada pelas regras locais atuais.</p>:<ul className="mt-3 divide-y divide-border">{d.ocorrencias.map((o,i)=><li key={`${o.regra}-${o.varianteId}-${i}`} className="flex items-start justify-between gap-4 py-3"><div><p className="text-sm font-medium">{o.mensagem}</p><p className="mt-1 text-xs text-muted-foreground">{o.acao} · {o.canal==="google"?"Google":"Loja"} · {o.severidade==="erro"?"Pendência":"Melhoria"}</p></div><button type="button" className="shrink-0 text-sm underline" onClick={()=>corrigir(o)}>Corrigir</button></li>)}</ul>}
      <div className="mt-4 text-xs text-muted-foreground">{d.canais.every(c=>c.resultadoExterno==="NAO_CONSULTADO")?"Google: aprovação ainda não consultada. Exportar o feed não confirma envio ou aprovação.":d.canais.map(c=><p key={`${c.nome}-${c.canal}`}>{c.nome} · {c.canal} · envio: {c.estadoEnvio} · resposta: {c.resultadoExterno}{c.consultadoEm?` · consulta em ${new Date(c.consultadoEm).toLocaleString("pt-BR")}`:""}</p>)}</div>
    </>}
  </section>;
}
