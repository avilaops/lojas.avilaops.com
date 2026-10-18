"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { SECOES_ATELIE, type TemaLoja } from "@/lib/tema";
import { Campo, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";

const ROTULO_SECAO: Record<(typeof SECOES_ATELIE)[number], string> = {
  hero: "Hero",
  categorias: "Categorias",
  destaques: "Mais vendidos",
  lookbook: "Lookbook",
  sobre: "Sobre",
};

type Look = NonNullable<NonNullable<TemaLoja["atelie"]>["looks"]>[number];
type Peca = { slug: string; nome: string };

/**
 * Campos do Ateliê em Configurações → Marca. A ordem do array `secoes` é a
 * ordem da home; seção fora do array fica desligada. Look sem duas peças
 * diferentes não é gravado.
 */
export default function EditorAtelie({
  tema,
  categorias,
  pecas,
  aoMudar,
}: {
  tema: TemaLoja;
  categorias: { slug: string; nome: string }[];
  pecas: Peca[];
  aoMudar: (tema: TemaLoja) => void;
}) {
  const atelie = tema.atelie ?? {};
  const ligadas = atelie.secoes ?? [...SECOES_ATELIE];
  const looks = atelie.looks ?? [];

  function gravar(mudanca: NonNullable<TemaLoja["atelie"]>) {
    aoMudar({ ...tema, atelie: { ...atelie, ...mudanca } });
  }

  function ligar(secao: (typeof SECOES_ATELIE)[number], ligada: boolean) {
    const atual = atelie.secoes ?? [...SECOES_ATELIE];
    const secoes = ligada ? [...atual.filter((item) => item !== secao), secao] : atual.filter((item) => item !== secao);
    gravar({ secoes });
  }

  function mover(secao: (typeof SECOES_ATELIE)[number], delta: number) {
    const atual = [...(atelie.secoes ?? SECOES_ATELIE)];
    const indice = atual.indexOf(secao);
    const destino = indice + delta;
    if (indice < 0 || destino < 0 || destino >= atual.length) return;
    [atual[indice], atual[destino]] = [atual[destino], atual[indice]];
    gravar({ secoes: atual });
  }

  function mudarLook(indice: number, mudanca: Partial<Look>) {
    gravar({ looks: looks.map((look, i) => (i === indice ? { ...look, ...mudanca } : look)) });
  }

  const ordem = [
    ...ligadas,
    ...SECOES_ATELIE.filter((secao) => !ligadas.includes(secao)),
  ];

  return (
    <fieldset className="mt-6 grid gap-4 rounded-xl border border-border p-4">
      <legend className="px-2 text-sm font-semibold">Ateliê</legend>
      <p className="text-sm text-muted-foreground">
        Foto grande, título em serifa e lookbook. Seção vazia não aparece na loja. O look aponta de duas a quatro peças que já estão no catálogo.
      </p>

      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seções da página inicial</p>
        {ordem.map((secao) => {
          const ligada = ligadas.includes(secao);
          const indice = ligadas.indexOf(secao);
          return (
            <div key={secao} className="flex min-h-11 flex-wrap items-center gap-2">
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input type="checkbox" checked={ligada} onChange={(e) => ligar(secao, e.target.checked)} />
                {ROTULO_SECAO[secao]}
              </label>
              <button type="button" className="btn-secundario" aria-label={`Subir ${ROTULO_SECAO[secao]}`} disabled={!ligada || indice === 0} onClick={() => mover(secao, -1)}><ArrowUp size={16} /></button>
              <button type="button" className="btn-secundario" aria-label={`Descer ${ROTULO_SECAO[secao]}`} disabled={!ligada || indice === ligadas.length - 1} onClick={() => mover(secao, 1)}><ArrowDown size={16} /></button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Título do hero"><input className={inputClasse} maxLength={120} value={tema.heroTitulo ?? ""} onChange={(e) => aoMudar({ ...tema, heroTitulo: e.target.value || undefined })} /></Campo>
        <Campo label="Texto do hero"><input className={inputClasse} maxLength={220} value={tema.heroTexto ?? ""} onChange={(e) => aoMudar({ ...tema, heroTexto: e.target.value || undefined })} /></Campo>
        <Campo label="Destino do botão" ajuda="Caminho interno. Vazio abre o catálogo.">
          <select className={inputClasse} value={atelie.heroLink ?? ""} onChange={(e) => gravar({ heroLink: e.target.value || undefined })}>
            <option value="">Catálogo</option>
            <option value="/produtos">Todos os produtos</option>
            {categorias.map((categoria) => <option key={categoria.slug} value={`/categoria/${categoria.slug}`}>{categoria.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Texto da seção Sobre" ajuda="Vazio usa o texto Sobre da loja, e depois o diferencial.">
          <textarea className={`${inputClasse} h-auto min-h-[5.5rem] py-2`} rows={3} maxLength={600} value={atelie.sobre ?? ""} onChange={(e) => gravar({ sobre: e.target.value.trim() ? e.target.value : undefined })} />
        </Campo>
      </div>

      <div className="grid gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lookbook</p>
        {pecas.length < 2 && <p className="text-sm text-muted-foreground">Cadastre pelo menos duas peças ativas para montar um look.</p>}
        {looks.map((look, indice) => (
          <div key={indice} className="grid gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <strong className="text-sm">Look {indice + 1}</strong>
              <button type="button" className="ml-auto text-sm text-muted-foreground underline" onClick={() => gravar({ looks: looks.filter((_, i) => i !== indice) })}>Remover</button>
            </div>
            <Campo label="Nome"><input className={inputClasse} maxLength={80} value={look.titulo} onChange={(e) => mudarLook(indice, { titulo: e.target.value })} /></Campo>
            <Campo label="Foto do look">
              <div className="flex items-center gap-2">
                <input className={inputClasse} value={look.imagem} onChange={(e) => mudarLook(indice, { imagem: e.target.value })} placeholder="URL ou envie um arquivo" />
                <EnviarImagem valorAtual={look.imagem || null} aoEnviar={(url) => mudarLook(indice, { imagem: url })} rotulo={look.imagem ? "Trocar foto" : "Enviar foto"} />
              </div>
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              {look.produtos.map((slug, ordem) => (
                <Campo key={ordem} label={`Peça ${ordem + 1}`}>
                  <select className={inputClasse} value={slug} onChange={(e) => mudarLook(indice, { produtos: look.produtos.map((item, i) => i === ordem ? e.target.value : item) })}>
                    {!pecas.some((peca) => peca.slug === slug) && <option value={slug}>{slug}</option>}
                    {pecas.filter((peca) => peca.slug === slug || !look.produtos.includes(peca.slug)).map((peca) => <option key={peca.slug} value={peca.slug}>{peca.nome}</option>)}
                  </select>
                </Campo>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {look.produtos.length < 4 && (
                <button type="button" className="btn-secundario" disabled={pecas.length === 0} onClick={() => {
                  const livre = pecas.find((peca) => !look.produtos.includes(peca.slug))?.slug ?? pecas[0]?.slug;
                  if (livre) mudarLook(indice, { produtos: [...look.produtos, livre] });
                }}>Adicionar peça</button>
              )}
              {look.produtos.length > 2 && (
                <button type="button" className="btn-secundario" onClick={() => mudarLook(indice, { produtos: look.produtos.slice(0, -1) })}>Tirar a última peça</button>
              )}
            </div>
          </div>
        ))}
        {looks.length < 6 && (
          <button type="button" className="btn-secundario w-fit" disabled={pecas.length < 2} onClick={() => gravar({
            looks: [...looks, { titulo: `Look ${String(looks.length + 1).padStart(2, "0")}`, imagem: "", produtos: [pecas[0].slug, pecas[1].slug] }],
          })}>Adicionar look</button>
        )}
      </div>
    </fieldset>
  );
}
