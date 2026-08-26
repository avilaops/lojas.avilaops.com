"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { formatarBRL } from "@/lib/catalogo";

interface Sugestao { slug: string; nome: string; precoCentavos: number; imagem: string | null; esgotado: boolean }
interface Categoria { slug: string; nome: string }

/**
 * Campo de busca com sugestões.
 *
 * O comprador de loja pequena costuma saber o nome do que quer e desistir se a
 * listagem não trouxer de primeira. Mostrar o produto embaixo do campo corta
 * um passo inteiro — e ainda avisa quando está esgotado antes do clique.
 */
export default function BuscaLoja() {
  const router = useRouter();
  const listaId = useId();
  const [termo, setTermo] = useState("");
  // O resultado guarda o termo que o produziu. Assim a lista some sozinha
  // quando a pessoa apaga ou muda o que digitou, sem limpar estado no efeito
  // (e sem piscar o resultado antigo enquanto a nova busca não volta).
  const [resultado, setResultado] = useState<{ termo: string; produtos: Sugestao[]; categorias: Categoria[] }>({ termo: "", produtos: [], categorias: [] });
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const caixa = useRef<HTMLDivElement>(null);

  // Espera a pessoa parar de digitar: sem isso é uma consulta por tecla.
  useEffect(() => {
    const q = termo.trim();
    if (q.length < 2) return;
    const cancelar = new AbortController();
    const relogio = setTimeout(() => {
      fetch(`/api/busca?q=${encodeURIComponent(q)}`, { signal: cancelar.signal })
        .then((r) => (r.ok ? r.json() : { produtos: [], categorias: [] }))
        .then((d) => {
          setResultado({ termo: q, produtos: d.produtos ?? [], categorias: d.categorias ?? [] });
          setAtivo(-1);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(relogio);
      cancelar.abort();
    };
  }, [termo]);

  // Clique fora fecha — o teclado fecha no Escape.
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, []);

  const atual = resultado.termo === termo.trim();
  const produtos = atual ? resultado.produtos : [];
  const categorias = atual ? resultado.categorias : [];
  const itens = [...produtos.map((p) => `/produtos/${p.slug}`), ...categorias.map((c) => `/categoria/${c.slug}`)];
  const mostrar = aberto && itens.length > 0;

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setAberto(false);
    if (!mostrar) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => (e.key === "ArrowDown" ? (i + 1) % itens.length : (i <= 0 ? itens.length : i) - 1));
    } else if (e.key === "Enter" && ativo >= 0) {
      e.preventDefault();
      setAberto(false);
      router.push(itens[ativo]);
    }
  }

  return (
    <div ref={caixa} className="busca-loja-caixa ml-auto hidden max-w-sm flex-1 md:block">
      <form
        action="/produtos"
        className="busca-loja flex items-center gap-2 rounded-full border border-border bg-card px-4"
        onSubmit={() => setAberto(false)}
        role="search"
      >
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          name="q"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={aoTeclar}
          placeholder="O que você procura?"
          aria-label="Buscar produtos"
          className="h-10 w-full bg-transparent text-sm outline-none"
          autoComplete="off"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={listaId}
          aria-autocomplete="list"
        />
      </form>

      {mostrar && (
        <ul id={listaId} role="listbox" aria-label="Sugestões" className="busca-sugestoes">
          {produtos.map((p, i) => (
            <li key={p.slug} role="option" aria-selected={ativo === i}>
              <a href={`/produtos/${p.slug}`} className={ativo === i ? "ativo" : undefined} onMouseEnter={() => setAtivo(i)}>
                <span className="busca-miniatura">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imagem && <img src={`${p.imagem}?w=480`} alt="" loading="lazy" />}
                </span>
                <span className="busca-nome">{p.nome}</span>
                <span className="busca-preco">{p.esgotado ? "esgotado" : formatarBRL(p.precoCentavos)}</span>
              </a>
            </li>
          ))}
          {categorias.map((c, i) => (
            <li key={c.slug} role="option" aria-selected={ativo === produtos.length + i}>
              <a href={`/categoria/${c.slug}`} className={ativo === produtos.length + i ? "ativo" : undefined} onMouseEnter={() => setAtivo(produtos.length + i)}>
                <span className="busca-nome">Ver tudo em <b>{c.nome}</b></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
