"use client";

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Campo, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";

/**
 * Cadastro rápido de um produto.
 *
 * A tela abria com nove campos empilhados, todos com o mesmo peso, rótulo em
 * caixa alta e texto de ajuda embaixo. Só **nome** é obrigatório, e a tela não
 * dizia isso: o lojista rolava oito campos antes de achar o botão de salvar.
 *
 * Agora só o essencial fica à vista (nome, preço, foto). O resto — código,
 * peso, estoque, preço "de", descrição — vai para um bloco recolhido, porque
 * quase todo cadastro rápido é feito sem eles e depois completado na tela do
 * produto.
 */
export type NovoProdutoDados = {
  nome: string; categoria: string; preco: string; precoDe: string; sku: string;
  pesoKg: string; estoque: string; imagem: string; descricaoCurta: string; destaque: boolean;
};

export default function NovoProduto({
  valor,
  aoMudar,
  aoSalvar,
  ocupado,
  categorias,
}: {
  valor: NovoProdutoDados;
  aoMudar: (v: NovoProdutoDados) => void;
  aoSalvar: () => void;
  ocupado: boolean;
  categorias: Array<{ slug: string; nome: string }>;
}) {
  const [aberto, setAberto] = useState(false);
  const [detalhes, setDetalhes] = useState(false);
  const set = (campo: keyof NovoProdutoDados, v: string | boolean) => aoMudar({ ...valor, [campo]: v });

  if (!aberto) {
    return (
      <div>
        <button className="btn-primario inline-flex h-11 items-center gap-2 px-4" onClick={() => setAberto(true)}>
          <Plus size={16} /> Novo produto
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <b>Novo produto</b>
        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          onClick={() => setAberto(false)}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      {/* O essencial: sem isto o produto não existe na vitrine. */}
      <Campo label="Nome do produto">
        <input
          className={inputClasse}
          value={valor.nome}
          onChange={(e) => set("nome", e.target.value)}
          placeholder="Rolamento 6205 2RS"
          autoFocus
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Preço">
          <input className={inputClasse} value={valor.preco} onChange={(e) => set("preco", e.target.value)} placeholder="59,90" inputMode="decimal" />
        </Campo>
        <Campo label="Categoria">
          {/* Lista o que já existe: digitar de novo cria categoria repetida com
              acento ou plural diferente. */}
          <input
            className={inputClasse}
            list="categorias-existentes"
            value={valor.categoria}
            onChange={(e) => set("categoria", e.target.value)}
            placeholder={categorias[0]?.nome ?? "Ex.: Vedações"}
          />
          <datalist id="categorias-existentes">
            {categorias.map((c) => <option key={c.slug} value={c.nome} />)}
          </datalist>
        </Campo>
      </div>

      <Campo label="Foto">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClasse} min-w-0 flex-1`}
            value={valor.imagem}
            onChange={(e) => set("imagem", e.target.value)}
            placeholder="Cole o link da imagem"
          />
          <EnviarImagem aoEnviar={(url) => aoMudar({ ...valor, imagem: url })} rotulo="Enviar arquivo" />
        </div>
      </Campo>

      {/* Recolhido: quase todo cadastro rápido é feito sem estes, e eles são
          completados depois na tela do produto. */}
      <details onToggle={(e) => setDetalhes((e.target as HTMLDetailsElement).open)}>
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground">
          <ChevronDown size={15} className={`transition-transform ${detalhes ? "rotate-180" : ""}`} aria-hidden="true" />
          Mais detalhes
          <span className="text-xs">código, peso, estoque, desconto</span>
        </summary>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Campo label="Código (SKU)">
            <input className={inputClasse} value={valor.sku} onChange={(e) => set("sku", e.target.value)} />
          </Campo>
          <Campo label="Estoque" ajuda="Vazio: não controla quantidade.">
            <input className={inputClasse} value={valor.estoque} onChange={(e) => set("estoque", e.target.value)} inputMode="numeric" />
          </Campo>
          <Campo label="Peso em kg" ajuda="Usado para calcular o frete.">
            <input className={inputClasse} value={valor.pesoKg} onChange={(e) => set("pesoKg", e.target.value)} inputMode="decimal" />
          </Campo>
          <Campo label="Preço antigo" ajuda="Mostra o desconto na vitrine.">
            <input className={inputClasse} value={valor.precoDe} onChange={(e) => set("precoDe", e.target.value)} inputMode="decimal" />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Descrição curta">
              <input className={inputClasse} value={valor.descricaoCurta} onChange={(e) => set("descricaoCurta", e.target.value)} />
            </Campo>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-5 w-5" checked={valor.destaque} onChange={(e) => set("destaque", e.target.checked)} />
            Mostrar em destaque na página inicial
          </label>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primario h-11" disabled={ocupado || valor.nome.trim().length < 2} onClick={aoSalvar}>
          Salvar produto
        </button>
        <button className="btn-secundario h-11 px-4" disabled={ocupado} onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
