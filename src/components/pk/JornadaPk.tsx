"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, Check, Hash, Layers, Ruler } from "lucide-react";
import Link from "@/components/LinkLoja";
import { ENTRADAS_PK } from "@/lib/jornada-pk";

const ICONES = [Hash, Ruler, Layers];

/** O fluxo orienta a navegação; nunca decide compatibilidade ou envia uma cotação. */
export default function JornadaPk({ compacta = false }: { compacta?: boolean }) {
  const [entrada, setEntrada] = useState<(typeof ENTRADAS_PK)[number]["id"]>("codigo");
  const atual = ENTRADAS_PK.find(item => item.id === entrada)!;
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-8" aria-label="Jornada de seleção PK">
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">Da identificação à cotação</span>
      <span className="text-sm text-muted-foreground">Uma etapa de cada vez.</span>
    </div>
    <fieldset>
      <legend className="mb-4 text-xl font-bold">O que você tem em mãos?</legend>
      <div className="grid gap-3 md:grid-cols-3">
        {ENTRADAS_PK.map((item, indice) => {
          const Icone = ICONES[indice];
          const ativo = item.id === entrada;
          return <label key={item.id} className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${ativo ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
            <input className="mt-1 size-4 shrink-0 accent-current" type="radio" name={compacta ? "entrada-pk-home" : "entrada-pk-jornada"} value={item.id} checked={ativo} onChange={() => setEntrada(item.id)} />
            <span className="min-w-0"><Icone className="mb-3 size-5 text-primary" aria-hidden="true" /><span className="block font-semibold">{item.titulo}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{item.detalhe}</span></span>
          </label>;
        })}
      </div>
    </fieldset>
    <div className="flex justify-center py-3 text-primary" aria-hidden="true"><ArrowDown className="size-6" /></div>
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-5" aria-live="polite" aria-atomic="true">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Seu próximo passo</p>
      <h3 className="mt-2 text-lg font-semibold">{atual.proximo}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{atual.orientacao}</p>
      <Link href={atual.href} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{atual.acao}<ArrowRight className="size-4" aria-hidden="true" /></Link>
    </div>
    <ol className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Quatro etapas para selecionar e cotar">
      {[
        { titulo: "Identificar", texto: "Código, medidas ou contexto do equipamento.", href: "/guias/medir-vedacoes", acao: "Conferir como medir" },
        { titulo: "Entender", texto: "Qual função a peça cumpre no conjunto?", href: "/guias/pu-nylon-funcoes", acao: "Conhecer as funções" },
        { titulo: "Conferir", texto: "Medidas, material, perfil e aplicação lado a lado.", href: "/comparar", acao: "Abrir comparação" },
        { titulo: "Cotar", texto: "Organizar códigos, quantidades e pendências.", href: "/cotacao-lote", acao: "Preparar minha lista" },
      ].map((etapa, indice) => <li key={etapa.titulo} className="min-w-0 rounded-xl border border-border p-4">
        <span className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">{indice + 1}</span>
        <h3 className="font-semibold">{etapa.titulo}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{etapa.texto}</p>
        <Link href={etapa.href} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{etapa.acao}</Link>
      </li>)}
    </ol>
    {!compacta && <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-50 p-5 text-emerald-950">
      <Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div><h3 className="font-semibold">Chegue ao atendimento com a peça bem identificada</h3><p className="mt-2 text-sm leading-relaxed">A equipe confirma aplicação, material, valores e disponibilidade antes da compra. Se houver dúvida, reúna fotos do perfil, desenho do alojamento e condições de operação.</p></div>
    </div>}
    {compacta && <Link href="/como-escolher" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">Ver o caminho completo<ArrowRight className="size-4" aria-hidden="true" /></Link>}
  </section>;
}
