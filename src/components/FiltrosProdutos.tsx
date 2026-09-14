import type { Categoria } from "@prisma/client";
import type { ChaveDeMedida } from "@/lib/catalogo";

/** Uma medida que a loja usa, com a faixa real do catálogo. */
export type MedidaDisponivel = { campo: ChaveDeMedida; rotulo: string; min: number; max: number; itens: number };

/** Prefixo curto na URL: `di_de=20&di_ate=25` é legível e cabe num link. */
const PREFIXO: Record<ChaveDeMedida, string> = {
  diametroInternoMm: "di",
  diametroExternoMm: "de",
  alturaMm: "alt",
};

/** Arredonda para o mm cheio, só no texto de ajuda. */
const mm = (v: number) => `${Math.round(v)} mm`;

/**
 * Barra de filtros da página de produtos. Formulário GET puro: funciona sem
 * JavaScript, cada combinação tem URL própria (compartilhável e indexável).
 *
 * A faixa de medida só aparece quando a loja tem medida cadastrada em volume
 * (ver `medidasDaLoja`). É a navegação que catálogo técnico exige: quem
 * procura peça sabe a medida do eixo, não o código do fabricante.
 */
export default function FiltrosProdutos({
  categorias,
  valores,
  medidas = [],
  fabricantes = [],
}: {
  categorias: Categoria[];
  valores: Record<string, string | undefined>;
  medidas?: MedidaDisponivel[];
  fabricantes?: string[];
}) {
  const usandoMedida = medidas.some((m) => valores[`${PREFIXO[m.campo]}_de`] || valores[`${PREFIXO[m.campo]}_ate`]);
  return (
    <form action="/produtos" className="filtros-produtos mb-6 grid gap-2 rounded-xl border border-border bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
        {valores.marca && valores.modelo && (
          <>
            <input type="hidden" name="marca" value={valores.marca} />
            <input type="hidden" name="modelo" value={valores.modelo} />
            {valores.ano && <input type="hidden" name="ano" value={valores.ano} />}
          </>
        )}
        {valores.moto === "todas" && <input type="hidden" name="moto" value="todas" />}
        <input name="q" type="search" aria-label="Buscar produtos" defaultValue={valores.q ?? ""} placeholder="Buscar" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
        {/* Categoria, preço e ordem empilhavam no celular e empurravam o
            primeiro produto para quase uma tela inteira de rolagem (medido em
            0,95 tela). Aqui eles vão para uma gaveta que só existe no celular:
            a partir de 640px o CSS a dissolve e os campos voltam para a linha.
            A busca continua sempre visível, que é por onde a maioria chega. */}
        <input type="checkbox" id="filtros-mais" className="filtros-gaveta" defaultChecked={!!(valores.categoria || valores.min || valores.max || valores.ordem || valores.fabricante)} />
        <label htmlFor="filtros-mais" className="filtros-abrir">Categoria, preço e ordem</label>
        <div className="filtros-campos contents">
          {fabricantes.length > 0 && <select name="fabricante" aria-label="Marca do produto" defaultValue={valores.fabricante ?? ""} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Todas as marcas</option>{fabricantes.map(m => <option key={m}>{m}</option>)}</select>}
          <select name="categoria" aria-label="Categoria" defaultValue={valores.categoria ?? ""} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.slug}>{c.nome}</option>)}
          </select>
          <input name="min" defaultValue={valores.min ?? ""} placeholder="R$ mín." inputMode="decimal" className="h-10 rounded-lg border border-border bg-background px-3 text-sm sm:w-24" />
          <input name="max" defaultValue={valores.max ?? ""} placeholder="R$ máx." inputMode="decimal" className="h-10 rounded-lg border border-border bg-background px-3 text-sm sm:w-24" />
          <select name="ordem" aria-label="Ordenar por" defaultValue={valores.ordem ?? "relevancia"} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="relevancia">Relevância</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
            <option value="recentes">Novidades</option>
            <option value="nome">Nome A–Z</option>
          </select>
        </div>
        <button className="btn-primario h-10 px-4 text-xs">Filtrar</button>
      </div>

      {medidas.length > 0 && (
        // `open` quando já há medida na URL: quem chegou por um link filtrado
        // precisa ver o que está filtrando, senão a lista parece curta sem motivo.
        <details open={usandoMedida} className="rounded-lg border border-border/70 bg-background/40">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
            Buscar pela medida
            {usandoMedida && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">ativo</span>}
          </summary>
          <div className="grid gap-3 px-3 pb-3 sm:grid-cols-3">
            {medidas.map((m) => {
              const p = PREFIXO[m.campo];
              return (
                <label key={m.campo} className="grid gap-1 text-xs text-muted-foreground">
                  <span>
                    {m.rotulo} <span className="opacity-60">({mm(m.min)}–{mm(m.max)})</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <input name={`${p}_de`} defaultValue={valores[`${p}_de`] ?? ""} placeholder="de" inputMode="decimal"
                      className="h-11 w-full rounded-lg border border-border bg-background px-2 text-sm" />
                    <span aria-hidden>–</span>
                    <input name={`${p}_ate`} defaultValue={valores[`${p}_ate`] ?? ""} placeholder="até" inputMode="decimal"
                      className="h-11 w-full rounded-lg border border-border bg-background px-2 text-sm" />
                  </span>
                </label>
              );
            })}
          </div>
        </details>
      )}
    </form>
  );
}
