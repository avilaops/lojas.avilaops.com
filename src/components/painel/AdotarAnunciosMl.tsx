"use client";

import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, Link2, RefreshCw, Search } from "lucide-react";
import { Secao } from "./campos";

type Casamento = { produtoId: string; por: "sku" | "gtin"; valor: string };

export type AnuncioParaAdotar = {
  mlbId: string;
  titulo: string;
  permalink: string | null;
  status: string | null;
  categoriaMl: string | null;
  precoCentavos: number;
  estoque: number;
  temVariacoes: boolean;
  skus: string[];
  casamento: Casamento | null;
  produtoNome: string | null;
  mudaria: { precoCentavos: number; estoque: number | null } | null;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Adotar o que o lojista já vende no Mercado Livre.
 *
 * Quase todo mundo que conecta o ML já vende lá, e até aqui conectar não
 * ligava nada: os anúncios dele ficavam fora da sincronia e as vendas
 * chegavam sem produto casado, logo sem baixar estoque.
 *
 * A tela **propõe e espera**. Vincular entrega o preço e o estoque da loja ao
 * anúncio — o ciclo seguinte manda os nossos por cima dos dele —, então cada
 * linha mostra o que está no ar hoje e o que passaria a valer. Sim cego aqui
 * muda preço de venda sem ninguém ter pedido.
 */
export default function AdotarAnunciosMl() {
  const [dados, setDados] = useState<{ totalNoMl: number; jaVinculados: number; varridos: number; anuncios: AnuncioParaAdotar[] } | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<"buscando" | "vinculando" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  async function procurar() {
    setErro(null);
    setRecado(null);
    setOcupado("buscando");
    try {
      const r = await fetch("/api/painel/canais/mercadolivre/adotar");
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não consegui ler seus anúncios.");
      setDados(d);
      setEscolhidos([]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  async function vincular() {
    const pares = (dados?.anuncios ?? [])
      .filter((a) => escolhidos.includes(a.mlbId) && a.casamento)
      .map((a) => ({ mlbId: a.mlbId, produtoId: a.casamento!.produtoId, categoriaMl: a.categoriaMl }));
    if (!pares.length) return;

    setErro(null);
    setOcupado("vinculando");
    try {
      const r = await fetch("/api/painel/canais/mercadolivre/adotar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pares }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não consegui vincular.");
      setRecado(`${d.vinculados} anúncio(s) vinculado(s). A partir do próximo ciclo, o preço e o estoque da loja mandam neles.`);
      setDados((atual) =>
        atual ? { ...atual, jaVinculados: atual.jaVinculados + d.vinculados, anuncios: atual.anuncios.filter((a) => !escolhidos.includes(a.mlbId)) } : atual,
      );
      setEscolhidos([]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  const casados = (dados?.anuncios ?? []).filter((a) => a.casamento);
  const soltos = (dados?.anuncios ?? []).filter((a) => !a.casamento);

  return (
    <Secao
      titulo="Anúncios que você já tem no Mercado Livre"
      descricao="Reconhecemos pelo SKU e pelo código de barras. Vincular entrega o preço e o estoque da loja ao anúncio — por isso cada linha mostra o que a loja mandaria, já com as regras do canal aplicadas, antes de você decidir."
    >
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {recado && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{recado}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secundario inline-flex h-10 items-center gap-2 px-4 text-sm" disabled={Boolean(ocupado)} onClick={procurar}>
          {ocupado === "buscando" ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
          Procurar meus anúncios
        </button>
        {dados && (
          <small className="text-xs text-muted-foreground">
            {dados.totalNoMl} ativo(s) no Mercado Livre · {dados.jaVinculados} já vinculado(s)
          </small>
        )}
      </div>

      {dados && dados.anuncios.length === 0 && (
        // A varredura tem teto, então "todos" só pode ser dito quando ela
        // alcançou tudo. Dizer que está resolvido com 400 anúncios não olhados
        // seria dar por pronto o que nem foi visto.
        <p className={`flex items-start gap-2 text-sm ${dados.varridos >= dados.totalNoMl ? "text-emerald-700" : "text-muted-foreground"}`}>
          <Check size={15} className="mt-0.5 flex-none" />
          {dados.varridos >= dados.totalNoMl
            ? "Todos os seus anúncios já estão ligados a produtos da loja."
            : `Os ${dados.varridos} anúncios mais recentes já estão ligados. Você tem ${dados.totalNoMl} no Mercado Livre — procure de novo para seguir pelos próximos.`}
        </p>
      )}

      {casados.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reconhecidos ({casados.length})
          </p>
          {casados.map((a) => {
            const marcado = escolhidos.includes(a.mlbId);
            const mudaPreco = a.mudaria && a.mudaria.precoCentavos !== a.precoCentavos;
            return (
              <label key={a.mlbId} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={marcado}
                  onChange={() => setEscolhidos((c) => (marcado ? c.filter((m) => m !== a.mlbId) : [...c, a.mlbId]))}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <b className="block truncate">{a.titulo}</b>
                  <span className="block text-xs text-muted-foreground">
                    → {a.produtoNome} · casou pelo {a.casamento!.por === "sku" ? "SKU" : "código de barras"} {a.casamento!.valor}
                  </span>
                  <span className="mt-1 block text-xs">
                    No ar: <b>{brl(a.precoCentavos)}</b>, {a.estoque} un.
                    {a.mudaria && (
                      <>
                        {" · "}a loja mandaria: <b className={mudaPreco ? "text-amber-700" : ""}>{brl(a.mudaria.precoCentavos)}</b>
                        {`, ${a.mudaria.estoque} un.`}
                      </>
                    )}
                  </span>
                  {a.temVariacoes && (
                    <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle size={12} className="mt-0.5 flex-none" />
                      Tem variações. O estoque da loja vai para o anúncio inteiro; a venda é reconhecida pelo SKU de cada variação.
                    </span>
                  )}
                </span>
                {a.permalink && (
                  <a href={a.permalink} target="_blank" rel="noopener" className="flex-none text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()} aria-label="Ver no Mercado Livre">
                    <ExternalLink size={14} />
                  </a>
                )}
              </label>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primario inline-flex items-center gap-2" disabled={Boolean(ocupado) || escolhidos.length === 0} onClick={vincular}>
              {ocupado === "vinculando" ? <RefreshCw size={15} className="animate-spin" /> : <Link2 size={15} />}
              Vincular {escolhidos.length || ""}
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setEscolhidos(escolhidos.length === casados.length ? [] : casados.map((a) => a.mlbId))}
            >
              {escolhidos.length === casados.length ? "limpar seleção" : "selecionar todos"}
            </button>
          </div>
        </div>
      )}

      {soltos.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sem identificador em comum ({soltos.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Não casamos por nome de propósito: &quot;Correia 5PK 1230&quot; e &quot;…1235&quot; são dois produtos, e ligar o errado mandaria
            o preço de um para o anúncio do outro. Coloque o mesmo SKU nos dois lados e procure de novo.
          </p>
          <ul className="grid max-h-64 gap-1 overflow-auto">
            {soltos.map((a) => (
              <li key={a.mlbId} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{a.titulo}</b>
                  <span className="text-xs text-muted-foreground">
                    {brl(a.precoCentavos)} · {a.estoque} un.
                    {a.skus.length ? ` · SKU no ML: ${a.skus.join(", ")}` : " · sem SKU no anúncio"}
                  </span>
                </span>
                {a.permalink && (
                  <a href={a.permalink} target="_blank" rel="noopener" className="flex-none text-muted-foreground hover:text-foreground" aria-label="Ver no Mercado Livre">
                    <ExternalLink size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Secao>
  );
}
