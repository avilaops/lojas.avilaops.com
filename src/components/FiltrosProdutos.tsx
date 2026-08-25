import type { Categoria } from "@prisma/client";

/**
 * Barra de filtros da página de produtos. Formulário GET puro: funciona sem
 * JavaScript, cada combinação tem URL própria (compartilhável e indexável).
 */
export default function FiltrosProdutos({ categorias, valores }: { categorias: Categoria[]; valores: { q?: string; categoria?: string; ordem?: string; min?: string; max?: string } }) {
  return (
    <form action="/produtos" className="mb-6 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
      <input name="q" defaultValue={valores.q ?? ""} placeholder="Buscar" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
      <select name="categoria" defaultValue={valores.categoria ?? ""} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
        <option value="">Todas as categorias</option>
        {categorias.map((c) => <option key={c.id} value={c.slug}>{c.nome}</option>)}
      </select>
      <input name="min" defaultValue={valores.min ?? ""} placeholder="R$ mín." inputMode="decimal" className="h-10 w-24 rounded-lg border border-border bg-background px-3 text-sm" />
      <input name="max" defaultValue={valores.max ?? ""} placeholder="R$ máx." inputMode="decimal" className="h-10 w-24 rounded-lg border border-border bg-background px-3 text-sm" />
      <select name="ordem" defaultValue={valores.ordem ?? "relevancia"} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
        <option value="relevancia">Relevância</option>
        <option value="menor-preco">Menor preço</option>
        <option value="maior-preco">Maior preço</option>
        <option value="recentes">Novidades</option>
        <option value="nome">Nome A–Z</option>
      </select>
      <button className="btn-primario h-10 px-4 text-xs">Filtrar</button>
    </form>
  );
}
