"use client";

import { useEffect, useMemo, useState } from "react";
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

const STATUS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  closed: "Encerrado",
  under_review: "Em revisão",
};

type DadosDosAnuncios = {
  totalNoMl: number;
  jaVinculados: number;
  varridos: number;
  anuncios: AnuncioParaAdotar[];
};

const normalizarBusca = (valor: string) =>
  valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

async function consultarAnuncios(): Promise<DadosDosAnuncios> {
  const resposta = await fetch("/api/painel/canais/mercadolivre/adotar?limite=200");
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui ler seus anúncios.");
  return dados;
}

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
  const [dados, setDados] = useState<DadosDosAnuncios | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<"buscando" | "vinculando" | null>("buscando");
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  async function procurar() {
    setErro(null);
    setRecado(null);
    setOcupado("buscando");
    try {
      setDados(await consultarAnuncios());
      setEscolhidos([]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  useEffect(() => {
    let montado = true;
    void consultarAnuncios()
      .then((resultado) => {
        if (montado) setDados(resultado);
      })
      .catch((e) => {
        if (montado) setErro(e instanceof Error ? e.message : "Falha inesperada.");
      })
      .finally(() => {
        if (montado) setOcupado(null);
      });
    return () => {
      montado = false;
    };
  }, []);

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

  const anunciosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    if (!termo) return dados?.anuncios ?? [];
    return (dados?.anuncios ?? []).filter((a) =>
      normalizarBusca([a.titulo, a.mlbId, a.produtoNome, ...a.skus].filter(Boolean).join(" ")).includes(termo),
    );
  }, [busca, dados]);
  const casados = anunciosFiltrados.filter((a) => a.casamento);
  const soltos = anunciosFiltrados.filter((a) => !a.casamento);
  const totalReconhecidos = (dados?.anuncios ?? []).filter((a) => a.casamento).length;
  const totalSemVinculo = (dados?.anuncios ?? []).length - totalReconhecidos;

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
          Atualizar anúncios
        </button>
        {dados && (
          <small className="text-xs text-muted-foreground">
            {dados.totalNoMl} ativo(s) no Mercado Livre · {dados.jaVinculados} já vinculado(s)
          </small>
        )}
      </div>

      {dados && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {([
              ["Ativos no Mercado Livre", dados.totalNoMl],
              ["Já vinculados", dados.jaVinculados],
              ["Reconhecidos", totalReconhecidos],
              ["Sem vínculo", totalSemVinculo],
            ] as const).map(([rotulo, total]) => (
              <div key={rotulo} className="rounded-lg border border-border p-3">
                <small className="text-xs text-muted-foreground">{rotulo}</small>
                <strong className="block text-xl">{total}</strong>
              </div>
            ))}
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Buscar anúncio</span>
            <input
              className="h-10 rounded-lg border border-border bg-background px-3"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, código MLB ou SKU"
            />
          </label>

          {busca && anunciosFiltrados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum anúncio encontrado para “{busca}”.</p>
          )}
        </>
      )}

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
            const mudaPreco = a.mudaria && !a.temVariacoes && a.mudaria.precoCentavos !== a.precoCentavos;
            const diferenca = a.mudaria ? a.precoCentavos - a.mudaria.precoCentavos : 0;
            const percentual = a.mudaria?.precoCentavos ? (diferenca / a.mudaria.precoCentavos) * 100 : 0;
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
                    {a.mudaria && !a.temVariacoes && (
                      <>
                        {" · "}a loja mandaria: <b className={mudaPreco ? "text-amber-700" : ""}>{brl(a.mudaria.precoCentavos)}</b>
                        {`, ${a.mudaria.estoque} un.`}
                      </>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {STATUS[a.status ?? ""] ?? a.status ?? "Status não informado"} · {a.mlbId}
                    {mudaPreco && (
                      <> · diferença: <b className={diferenca < 0 ? "text-red-700" : "text-amber-700"}>{diferenca > 0 ? "+" : ""}{brl(diferenca)} ({percentual > 0 ? "+" : ""}{percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)</b></>
                    )}
                  </span>
                  {a.temVariacoes && (
                    <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle size={12} className="mt-0.5 flex-none" />
                      Tem variações: preço e estoque continuam sendo editados por você no Mercado Livre. O que a adoção resolve
                      aqui é a venda — ela passa a casar com o produto e a baixar a apresentação certa, pelo SKU da variação.
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
                  <span className="block text-xs text-muted-foreground">
                    {STATUS[a.status ?? ""] ?? a.status ?? "Status não informado"} · {a.mlbId}
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
