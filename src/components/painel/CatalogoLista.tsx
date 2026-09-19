"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { Secao } from "./campos";
import ListaDeRegistros from "@/components/aplicacao/ListaDeRegistros";
import Paginacao from "@/components/aplicacao/Paginacao";
import Filtros from "@/components/aplicacao/Filtros";
import Vazio from "@/components/aplicacao/Vazio";
import BaixarPlanilha from "./BaixarPlanilha";

/**
 * O catálogo do painel: busca, filtro e página.
 *
 * A tela trazia os 500 primeiros produtos ordenados por nome e mais nada. Numa
 * distribuidora com 5.591 itens o lojista não enxergava 91% do que vende, e
 * para mexer no preço de um produto que começa com "R" não havia caminho.
 *
 * Depois da paginação ela ainda ficava com 9.201px de altura e 101 alvos de
 * toque abaixo de 44px no celular, porque montava a própria tabela: agora usa
 * os mesmos primitives do Inventário, e ganha o cartão tocável de graça.
 *
 * A busca é a mesma da vitrine (`termosDeBusca`), então "ROL6205" e "25x52x15"
 * funcionam aqui também: é o gesto que o lojista já conhece.
 */
type Item = {
  id: string;
  nome: string;
  categoria: string | null;
  sku: string | null;
  precoCentavos: number;
  estoque: number | null;
  ativo: boolean;
  destaque: boolean;
  opcoes: string[];
  variantes: number;
  temFoto: boolean;
};

type Resposta = { total: number; pagina: number; paginas: number; porPagina: number; produtos: Item[] };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Os filtros respondem à pergunta do dia, não a um campo do banco. */
const SITUACOES = [
  { valor: "", rotulo: "Todos" },
  { valor: "esgotado", rotulo: "Esgotados" },
  { valor: "sem-foto", rotulo: "Sem foto" },
  { valor: "sem-preco", rotulo: "Sem preço" },
  // Sem medida é o que faz o frete sair pela caixa padrão da loja, quase
  // sempre mais caro que o real — o aviso do topo da tela vira trabalho aqui.
  { valor: "sem-medida", rotulo: "Sem medida" },
  { valor: "inativo", rotulo: "Desativados" },
];

export default function CatalogoLista({
  categorias,
  chamar,
  ocupado,
}: {
  categorias: Array<{ slug: string; nome: string }>;
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
}) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Espera a pessoa parar de digitar: sem isso é uma consulta por tecla num
  // catálogo de milhares de itens.
  useEffect(() => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      setAplicada(busca.trim());
      setPagina(1);
    }, 300);
    return () => { if (relogio.current) clearTimeout(relogio.current); };
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const p = new URLSearchParams({ pagina: String(pagina) });
    if (aplicada) p.set("q", aplicada);
    if (categoria) p.set("categoria", categoria);
    if (situacao) p.set("situacao", situacao);
    try {
      const r = await fetch(`/api/painel/catalogo?${p}`);
      if (r.ok) setDados((await r.json()) as Resposta);
    } catch {
      // Falha de rede não apaga a lista que já está na tela.
    } finally {
      setCarregando(false);
    }
  }, [pagina, aplicada, categoria, situacao]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function desativar(p: Item) {
    await chamar(`/api/painel/produtos?id=${p.id}`, "DELETE", undefined, "Produto desativado.");
    void carregar();
  }

  const filtrando = Boolean(aplicada || categoria || situacao);

  const preco = (p: Item) =>
    p.precoCentavos > 0 ? brl(p.precoCentavos) : <span className="text-muted-foreground">sob consulta</span>;

  const estoque = (p: Item) =>
    p.opcoes.length
      ? `${p.variantes} variações`
      : p.estoque == null
        ? "∞"
        : p.estoque === 0
          ? <span className="font-medium text-red-700">esgotado</span>
          : `${p.estoque} em estoque`;

  return (
    <Secao
      titulo="Catálogo"
      descricao="Procure pelo nome, código ou medida. Toque no produto para editar fotos, descrição, estoque e preço."
    >
      <Filtros
        busca={busca}
        aoBuscar={setBusca}
        exemplo="Nome, código ou medida (ex.: 6205, 25x52x15)"
        ativa={situacao}
        aoEscolher={(v) => { setSituacao(v); setPagina(1); }}
        fichas={SITUACOES}
        extra={
          <select
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base sm:w-auto sm:flex-none sm:text-sm"
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setPagina(1); }}
            aria-label="Categoria"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>{c.nome}</option>
            ))}
          </select>
        }
      />

      {dados && (
        <>
          <ListaDeRegistros
            itens={dados.produtos}
            carregando={carregando}
            href={(p) => `/painel/produtos/${p.id}`}
            titulo={(p) => (
              <>
                {p.destaque && "★ "}
                {p.nome}
                {!p.ativo && " (inativo)"}
              </>
            )}
            subtitulo={(p) => [p.categoria, p.sku && `Código ${p.sku}`].filter(Boolean).join(" · ") || null}
            selo={(p) => (
              <>
                <b className="tabular-nums">{preco(p)}</b>
                <span className="text-muted-foreground">{estoque(p)}</span>
                {/* Sem foto é o problema mais caro de um catálogo grande, e
                    aparece no lugar onde a decisão é tomada. */}
                {!p.temFoto && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">
                    <ImageOff size={10} aria-hidden="true" /> sem foto
                  </span>
                )}
              </>
            )}
            colunas={[
              { rotulo: "Produto", celula: (p) => (
                <>
                  {p.destaque && "★ "}
                  {p.nome}
                  {!p.ativo && " (inativo)"}
                  {!p.temFoto && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                      <ImageOff size={10} aria-hidden="true" /> sem foto
                    </span>
                  )}
                </>
              ) },
              { rotulo: "Categoria", celula: (p) => p.categoria ?? "—", largura: "w-32" },
              { rotulo: "Código", celula: (p) => p.sku ?? "—", largura: "w-24" },
              { rotulo: "Preço", celula: preco, largura: "w-28", numero: true },
              { rotulo: "Estoque", celula: estoque, largura: "w-32", numero: true },
            ]}
            acoes={(p) =>
              p.ativo ? (
                <button
                  className="inline-flex h-11 items-center px-2 text-muted-foreground underline"
                  disabled={ocupado}
                  onClick={() => desativar(p)}
                >
                  desativar
                </button>
              ) : null
            }
            vazio={
              <Vazio
                titulo={filtrando ? "Nenhum produto com esses filtros." : "Nenhum produto cadastrado ainda."}
                texto={
                  filtrando
                    ? "Tente outro termo, ou limpe os filtros para ver o catálogo inteiro."
                    : "Cadastre o primeiro produto ou importe sua planilha para começar a vender."
                }
                acao={
                  filtrando
                    ? { rotulo: "Limpar filtros", onClick: () => { setBusca(""); setCategoria(""); setSituacao(""); } }
                    : undefined
                }
              />
            }
          />

          <Paginacao
            pagina={dados.pagina}
            paginas={dados.paginas}
            total={dados.total}
            porPagina={dados.porPagina}
            ocupado={carregando || ocupado}
            aoMudar={setPagina}
            substantivo="produtos"
          />

          {/* Baixar o catálogo era o que faltava para o caminho de volta da
              planilha: até aqui dava para subir 5.591 itens e não dava para
              pegá-los de volta para corrigir preço ou medida em lote. */}
          {dados.total > 0 && (
            <BaixarPlanilha
              tipo="produtos"
              total={dados.total}
              filtros={{ q: aplicada, categoria, situacao }}
              rotulo={
                filtrando
                  ? `Baixar estes ${dados.total.toLocaleString("pt-BR")} produtos:`
                  : "Baixar o catálogo:"
              }
              ajuda="Os dois voltam pela importação, com as mesmas colunas. O Excel guarda código e código de barras como texto; o CSV abre em qualquer lugar."
            />
          )}
        </>
      )}
    </Secao>
  );
}
