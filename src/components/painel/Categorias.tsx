"use client";

import { useState } from "react";
import { Campo, Secao, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";

export interface CategoriaView {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  imagemUrl: string | null;
  ordem: number;
  produtos: number;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  seoPendente: boolean;
  seoOrigem: string | null;
  seoModelo: string | null;
  seoAtualizadoEm: string | null;
  seoProcessandoEm: string | null;
  seoErro: string | null;
}

interface FormularioCategoria {
  id: string;
  nome: string;
  descricao: string;
  imagemUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOrigem: "manual" | "gemini" | "fallback";
  seoModelo: string | null;
  contexto: string;
}

interface RascunhoSeo {
  dados: { titulo: string; descricao: string; palavrasChave: string[] };
  origem: "manual" | "gemini" | "fallback";
  modelo: string | null;
}

const VAZIO: FormularioCategoria = {
  id: "",
  nome: "",
  descricao: "",
  imagemUrl: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  seoOrigem: "manual",
  seoModelo: null,
  contexto: "",
};

export default function Categorias({ categorias, chamar, ocupado }: {
  categorias: CategoriaView[];
  chamar: (caminho: string, metodo: string, corpo?: unknown, sucesso?: string) => Promise<unknown>;
  ocupado: boolean;
}) {
  const [f, setF] = useState<FormularioCategoria>(VAZIO);

  const editar = (c: CategoriaView) => setF({
    id: c.id,
    nome: c.nome,
    descricao: c.descricao ?? "",
    imagemUrl: c.imagemUrl ?? "",
    seoTitle: c.seoTitle ?? "",
    seoDescription: c.seoDescription ?? "",
    seoKeywords: c.seoKeywords.join(", "),
    seoOrigem: c.seoOrigem === "gemini" || c.seoOrigem === "fallback" ? c.seoOrigem : "manual",
    seoModelo: c.seoModelo,
    contexto: "",
  });
  const limpar = () => setF(VAZIO);

  async function salvarCategoria() {
    const resposta = await chamar("/api/painel/categorias", "POST", {
      id: f.id || undefined,
      nome: f.nome,
      descricao: f.descricao || null,
      imagemUrl: f.imagemUrl || null,
    }, "Categoria salva.");
    if (resposta && !f.id) limpar();
  }

  async function gerarSeo() {
    const rascunho = await chamar("/api/painel/categorias/seo", "POST", {
      id: f.id,
      contexto: f.contexto || undefined,
    }, "Rascunho gerado. Revise antes de publicar.") as RascunhoSeo | undefined;
    if (!rascunho?.dados) return;
    setF((atual) => ({
      ...atual,
      seoTitle: rascunho.dados.titulo,
      seoDescription: rascunho.dados.descricao,
      seoKeywords: rascunho.dados.palavrasChave.join(", "),
      seoOrigem: rascunho.origem,
      seoModelo: rascunho.modelo,
    }));
  }

  async function publicarSeo() {
    const palavrasChave = f.seoKeywords.split(/[\n,;]/).map((p) => p.trim()).filter(Boolean);
    await chamar("/api/painel/categorias/seo", "PUT", {
      id: f.id,
      titulo: f.seoTitle,
      descricao: f.seoDescription,
      palavrasChave,
      origem: f.seoOrigem,
      modelo: f.seoModelo,
    }, "SEO publicado e enviado para indexação.");
  }

  return (
    <Secao titulo={`Categorias (${categorias.length})`} descricao="Organize a vitrine e publique o SEO de cada seção sem gerar conteúdo durante a visita do cliente.">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
        <input className={inputClasse} placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <input className={inputClasse} placeholder="Descrição da categoria" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        <EnviarImagem aoEnviar={(url) => setF({ ...f, imagemUrl: url })} rotulo={f.imagemUrl ? "Trocar imagem" : "Imagem"} />
        <button className="btn-primario" disabled={ocupado || !f.nome.trim()} onClick={salvarCategoria}>{f.id ? "Salvar categoria" : "Adicionar"}</button>
      </div>

      {f.id && (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Busca e descoberta</h3>
              <p className="mt-1 text-xs text-muted-foreground">A IA usa apenas esta categoria e os produtos reais vinculados a ela. O rascunho só entra na loja depois da sua publicação.</p>
            </div>
            <button className="text-xs underline" onClick={limpar}>fechar edição</button>
          </div>
          <div className="mt-4 grid gap-4">
            <Campo label="Contexto opcional" ajuda="Ex.: priorizar peças para revisão preventiva. Não inclua promessas que a loja não cumpre.">
              <input className={inputClasse} value={f.contexto} onChange={(e) => setF({ ...f, contexto: e.target.value })} maxLength={500} />
            </Campo>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-secundario" disabled={ocupado} onClick={gerarSeo}>Gerar rascunho com IA</button>
              <span className="text-xs text-muted-foreground">Sem chave Gemini, a plataforma cria um rascunho seguro com os dados do catálogo.</span>
            </div>
            <Campo label="Título para o Google" ajuda={`${f.seoTitle.length}/70 caracteres. O nome da loja é acrescentado automaticamente.`}>
              <input className={inputClasse} value={f.seoTitle} onChange={(e) => setF({ ...f, seoTitle: e.target.value, seoOrigem: "manual", seoModelo: null })} maxLength={70} />
            </Campo>
            <Campo label="Descrição para o Google" ajuda={`${f.seoDescription.length}/170 caracteres.`}>
              <textarea className={`${inputClasse} min-h-24 py-3`} value={f.seoDescription} onChange={(e) => setF({ ...f, seoDescription: e.target.value, seoOrigem: "manual", seoModelo: null })} maxLength={170} />
            </Campo>
            <Campo label="Termos relacionados" ajuda="Separe por vírgula. Use no máximo 10 termos que realmente existam no catálogo.">
              <input className={inputClasse} value={f.seoKeywords} onChange={(e) => setF({ ...f, seoKeywords: e.target.value, seoOrigem: "manual", seoModelo: null })} />
            </Campo>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primario" disabled={ocupado || f.seoTitle.trim().length < 3 || f.seoDescription.trim().length < 40} onClick={publicarSeo}>Revisar e publicar SEO</button>
              <span className="text-xs text-muted-foreground">Origem atual: {f.seoOrigem}{f.seoModelo ? ` · ${f.seoModelo}` : ""}</span>
            </div>
          </div>
        </div>
      )}

      {categorias.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {categorias.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 py-3">
              {c.imagemUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica enviada pelo lojista
                <img src={c.imagemUrl} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span className="font-medium">{c.nome}</span>
              <span className="text-xs text-muted-foreground">{c.produtos} produto(s)</span>
              <span className={`rounded-full px-2 py-1 text-[11px] ${c.seoPendente ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                {c.seoProcessandoEm ? "SEO processando" : c.seoPendente ? "SEO pendente" : "SEO publicado"}
              </span>
              {c.seoErro && <span className="max-w-48 truncate text-xs text-red-700" title={c.seoErro}>falha na última tentativa</span>}
              <span className="ml-auto flex gap-2 text-xs">
                {i > 0 && <button className="underline" disabled={ocupado} onClick={async () => {
                  const primeiro = await chamar("/api/painel/categorias", "POST", { id: c.id, nome: c.nome, ordem: Math.max(0, categorias[i - 1].ordem - 1) }, "Ordem atualizada.");
                  if (primeiro) await chamar("/api/painel/categorias", "POST", { id: categorias[i - 1].id, nome: categorias[i - 1].nome, ordem: c.ordem + 1 }, "Ordem atualizada.");
                }}>↑</button>}
                <button className="underline" onClick={() => editar(c)}>editar</button>
                <button className="text-muted-foreground underline" disabled={ocupado} onClick={() => confirm(`Apagar a categoria ${c.nome}? Os produtos ficam sem categoria.`) && chamar(`/api/painel/categorias?id=${c.id}`, "DELETE", undefined, "Categoria apagada.")}>apagar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Campo label="" ajuda="A categoria também nasce automaticamente quando um produto recebe um nome de categoria novo. O SEO fica pendente para revisão ou processamento no n8n."><span /></Campo>
    </Secao>
  );
}
