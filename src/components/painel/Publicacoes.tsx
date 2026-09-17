"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, FileText, Plus } from "lucide-react";
import { Campo, Secao, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";
import { minutosDeLeitura, resumoDe } from "@/lib/publicacoes";

/**
 * Publicações do blog da loja.
 *
 * Lista → editor → voltar, como o resto do painel no celular. O botão que
 * importa é "Salvar rascunho": escrever um texto de mil palavras no celular
 * leva várias sessões, e um editor onde a única saída é publicar faz o lojista
 * publicar pela metade.
 */

interface Publicacao {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  corpo: string;
  capaUrl: string | null;
  autor: string | null;
  estado: "rascunho" | "publicada";
  publicadoEm: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

const VAZIA: Publicacao = {
  id: "", slug: "", titulo: "", resumo: null, corpo: "", capaUrl: null,
  autor: null, estado: "rascunho", publicadoEm: null, seoTitle: null, seoDescription: null,
};

export default function Publicacoes({ urlLoja }: { urlLoja: string }) {
  const [lista, setLista] = useState<Publicacao[] | null>(null);
  /**
   * O instante em que a tela abriu, fixado uma vez.
   *
   * É o que separa "agendada" de "no ar", e ler o relógio a cada renderização
   * faria a mesma lista mudar de rótulo sem nada ter acontecido — além de ser
   * impuro durante a renderização. Uma lista de painel é um retrato: quem
   * quiser o estado de agora recarrega.
   */
  const [agora] = useState(() => Date.now());
  const [aberta, setAberta] = useState<Publicacao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/painel/publicacoes")
      .then((r) => r.json())
      .then((d) => setLista(d.publicacoes ?? []))
      .catch(() => setLista([]));
  }, []);

  if (aberta) {
    return (
      <Editor
        inicial={aberta}
        urlLoja={urlLoja}
        aoVoltar={() => setAberta(null)}
        aoSalvar={(salva, msg) => {
          setLista((l) => {
            const atuais = l ?? [];
            return atuais.some((p) => p.id === salva.id)
              ? atuais.map((p) => (p.id === salva.id ? salva : p))
              : [salva, ...atuais];
          });
          setAviso(msg);
          setAberta(null);
        }}
        aoApagar={(id) => {
          setLista((l) => (l ?? []).filter((p) => p.id !== id));
          setAviso("Publicação apagada.");
          setAberta(null);
        }}
      />
    );
  }

  return (
    <div className="grid gap-6">
      {aviso && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{aviso}</p>}

      <Secao
        titulo="Publicações"
        descricao="Textos no blog da sua loja. É por eles que entra quem ainda não sabe que precisa do seu produto."
      >
        {lista === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="grid justify-items-start gap-3 py-4">
            <FileText size={28} className="text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">Escreva uma publicação</p>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                A maior parte de quem chega numa loja pequena pela busca não digitou o nome de um produto: digitou uma
                pergunta. Responder a pergunta na sua loja é o que faz a página do produto ser achada depois.
              </p>
            </div>
          </div>
        ) : (
          <ul className="-mx-4 border-y border-border sm:-mx-6">
            {lista.map((p) => (
              <li key={p.id} className="border-t border-border first:border-t-0">
                <button
                  type="button"
                  onClick={() => setAberta(p)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition active:bg-muted sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.titulo}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {resumoDe(p, 90)}
                    </span>
                  </span>
                  <Estado publicacao={p} agora={agora} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setAberta({ ...VAZIA })}
          className="btn-primario inline-flex h-11 items-center gap-2 px-4"
        >
          <Plus size={16} aria-hidden="true" /> Criar publicação
        </button>
      </Secao>
    </div>
  );
}

/**
 * Agendado é um estado que o lojista precisa distinguir de publicado: dizer
 * "publicada" num texto marcado para semana que vem faz ele procurar na loja
 * um post que não está lá.
 */
function Estado({ publicacao, agora }: { publicacao: Publicacao; agora: number }) {
  if (publicacao.estado === "rascunho") {
    return <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Rascunho</span>;
  }
  const data = publicacao.publicadoEm ? new Date(publicacao.publicadoEm) : null;
  if (data && data.getTime() > agora) {
    return <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Agendada</span>;
  }
  return <span className="flex-none rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">No ar</span>;
}

function Editor({
  inicial,
  urlLoja,
  aoVoltar,
  aoSalvar,
  aoApagar,
}: {
  inicial: Publicacao;
  urlLoja: string;
  aoVoltar: () => void;
  aoSalvar: (p: Publicacao, msg: string) => void;
  aoApagar: (id: string) => void;
}) {
  const [p, setP] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const novo = !inicial.id;
  const set = (k: keyof Publicacao, v: unknown) => setP({ ...p, [k]: v });

  async function salvar(estado: "rascunho" | "publicada") {
    if (p.titulo.trim().length < 3) return setErro("O título precisa de pelo menos 3 letras.");
    if (!p.corpo.trim()) return setErro("Escreva o texto antes de salvar.");
    setErro(null);
    setOcupado(true);
    try {
      const corpo = {
        ...(novo ? {} : { id: p.id }),
        titulo: p.titulo.trim(),
        resumo: p.resumo?.trim() || null,
        corpo: p.corpo,
        capaUrl: p.capaUrl || null,
        autor: p.autor?.trim() || null,
        estado,
        publicadoEm: p.publicadoEm || null,
        seoTitle: p.seoTitle?.trim() || null,
        seoDescription: p.seoDescription?.trim() || null,
      };
      const r = await fetch("/api/painel/publicacoes", {
        method: novo ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      aoSalvar(d.publicacao, estado === "publicada" ? "Publicação no ar." : "Rascunho salvo.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    const r = await fetch(`/api/painel/publicacoes?id=${p.id}`, { method: "DELETE" });
    setOcupado(false);
    if (r.ok) aoApagar(p.id);
    else setErro("Não deu para apagar agora.");
  }

  return (
    <div className="grid gap-4">
      <button type="button" onClick={aoVoltar} className="-mt-1 inline-flex h-11 items-center gap-1 self-start pr-3 text-sm text-muted-foreground">
        <ChevronLeft size={16} aria-hidden="true" /> Publicações
      </button>

      <Secao titulo={novo ? "Nova publicação" : "Editar publicação"}>
        <Campo label="Título" obrigatorio>
          <input className={inputClasse} value={p.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Com que frequência trocar o óleo da moto" />
        </Campo>

        <Campo label="Texto" obrigatorio ajuda="Linha em branco separa parágrafo. O texto é publicado como texto: HTML colado não vira formatação.">
          <textarea
            className={`${inputClasse} h-auto py-3 leading-relaxed`}
            rows={18}
            value={p.corpo}
            onChange={(e) => set("corpo", e.target.value)}
          />
        </Campo>
        {p.corpo.trim() && (
          <p className="text-xs text-muted-foreground">
            {p.corpo.trim().split(/\s+/).length.toLocaleString("pt-BR")} palavras · {minutosDeLeitura(p.corpo)} min de leitura
          </p>
        )}

        <Campo label="Chamada" ajuda="Opcional. Aparece na listagem e na busca. Sem ela, usamos o começo do texto.">
          <textarea className={`${inputClasse} h-auto py-2`} rows={2} maxLength={300} value={p.resumo ?? ""} onChange={(e) => set("resumo", e.target.value)} />
        </Campo>

        <Campo label="Capa" ajuda="Opcional. Aparece na listagem e quando o link é compartilhado.">
          <div className="flex flex-wrap items-center gap-3">
            {p.capaUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.capaUrl} alt="" className="h-20 w-28 rounded-lg border border-border object-cover" />
                <button type="button" className="text-xs text-red-700 underline" onClick={() => set("capaUrl", null)}>remover</button>
              </>
            )}
            <EnviarImagem aoEnviar={(url) => set("capaUrl", url)} rotulo={p.capaUrl ? "trocar" : "+ capa"} />
          </div>
        </Campo>

        <Campo label="Autor" ajuda="Opcional. Sem autor, assina a loja.">
          <input className={inputClasse} value={p.autor ?? ""} onChange={(e) => set("autor", e.target.value)} />
        </Campo>

        {!novo && (
          <Campo label="Endereço na loja" ajuda="Mudar isto quebra o link de quem já compartilhou o texto.">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{urlLoja}/blog/</span>
              <input className={`${inputClasse} max-w-64`} value={p.slug} onChange={(e) => set("slug", e.target.value)} />
            </div>
          </Campo>
        )}

        <Campo
          label="Data de publicação"
          ajuda="Deixe em branco para publicar agora. Data futura agenda: o texto só aparece na loja quando chegar."
        >
          <input
            type="datetime-local"
            className={`${inputClasse} max-w-64`}
            value={p.publicadoEm ? new Date(p.publicadoEm).toISOString().slice(0, 16) : ""}
            onChange={(e) => set("publicadoEm", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Campo>

        {erro && <p className="campo-erro" role="alert">{erro}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={ocupado} onClick={() => salvar("publicada")} className="btn-primario h-11 px-5">
            {p.estado === "publicada" ? "Salvar e manter no ar" : "Publicar"}
          </button>
          <button type="button" disabled={ocupado} onClick={() => salvar("rascunho")} className="btn-secundario h-11 px-4">
            Salvar rascunho
          </button>
          {!novo && (
            <button type="button" disabled={ocupado} onClick={apagar} className="ml-auto h-11 text-sm text-red-700 underline underline-offset-2">
              Apagar
            </button>
          )}
        </div>
      </Secao>

      <Secao titulo="Busca" descricao="Como este texto aparece no Google. Em branco, usamos o título e a chamada.">
        <Campo label="Título na busca" ajuda="Até 70 caracteres.">
          <input className={inputClasse} maxLength={70} value={p.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} placeholder={p.titulo} />
        </Campo>
        <Campo label="Descrição na busca" ajuda="Até 180 caracteres.">
          <textarea className={`${inputClasse} h-auto py-2`} rows={2} maxLength={180} value={p.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} placeholder={resumoDe(p, 160)} />
        </Campo>
      </Secao>
    </div>
  );
}
