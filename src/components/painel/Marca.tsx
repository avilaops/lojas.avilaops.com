"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LAYOUTS, type TemaLoja } from "@/lib/tema";
import { LIMITE_RASCUNHO, codificarRascunho } from "@/lib/previa-tema";
import { criarDirecaoVisual, PERSONALIDADES, SEGMENTOS, type IdentidadeLoja } from "@/lib/identidade";
import { Campo, FONTES, Secao, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";
import EditorEtapas from "@/components/templates/automotivo-premium/EditorEtapas";
import type { LojaView } from "./PainelLoja";

/**
 * Configurações → Marca.
 *
 * Era um formulário só, com trinta campos em sequência: segmento, tom, público,
 * diferencial, personalidade, fotografia, objetivo, cor, modo, fonte, cantos,
 * categoria sem foto, ramo, layout, slogan, banner, logo, aviso, WhatsApp,
 * e-mail, domínio, JSON... e um "Publicar identidade" no fim. No iPhone eram
 * dez telas de rolagem para algo que se muda uma vez por semestre, e abrir
 * "Marca" recebia um formulário em vez de uma resposta.
 *
 * Agora abrir Marca mostra a marca como está: quatro blocos, cada um com o
 * resumo do estado atual e o que falta. Editar é um passo a mais, e só o
 * bloco pedido aparece (`?bloco=direcao|visual|vitrine|contato`), com o seu
 * próprio Salvar. O endereço carrega o bloco: voltar no navegador volta ao
 * resumo, e o link pode ser colado.
 *
 * Salvar continua manual, como era: cada bloco manda só os campos dele para
 * o mesmo PATCH de antes. Nada de autosave escondido.
 */
type Bloco = "direcao" | "visual" | "vitrine" | "contato";

const BLOCOS: Record<Bloco, { titulo: string; descricao: string }> = {
  direcao: { titulo: "Direção da marca", descricao: "Segmento, público, diferencial e personalidade" },
  visual: { titulo: "Identidade visual", descricao: "Cor, fonte, cantos e modo" },
  vitrine: { titulo: "Vitrine", descricao: "Layout da página inicial, campanhas em imagem, logo e slogan" },
  contato: { titulo: "Contato e avisos", descricao: "WhatsApp, e-mail, barra de avisos e domínio" },
};

const TOM: Record<string, string> = { direto: "Direto", proximo: "Próximo", especialista: "Especialista", inspirador: "Inspirador" };
const FOTO: Record<string, string> = { produto: "Produto", editorial: "Editorial", lifestyle: "Em uso", natural: "Natural", tecnico: "Técnica" };
const OBJETIVO: Record<string, string> = { vender: "Vender", posicionar: "Posicionar", captar: "Captar contatos", lancar: "Lançar novidade" };
const MODO: Record<string, string> = { claro: "Claro", escuro: "Escuro" };
const RAIO: Record<string, string> = { reto: "Retos", suave: "Suaves", redondo: "Redondos" };

const rotulo = (lista: ReadonlyArray<readonly [string, string]>, v: string) => lista.find(([k]) => k === v)?.[1] ?? v;

export default function Marca({
  loja,
  chamar,
  ocupado,
  categorias,
}: {
  loja: LojaView;
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
  categorias: {slug: string; nome: string}[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const bloco = params.get("bloco") as Bloco | null;

  // Um estado por bloco: salvar Direção não manda o slogan que a pessoa
  // deixou pela metade em outro bloco.
  const [identidade, setIdentidade] = useState<IdentidadeLoja>(loja.identidade);
  const [tema, setTema] = useState<TemaLoja>({ ...loja.tema });
  const [segmento, setSegmento] = useState(loja.segmento);
  // Responsável técnico: exigência da RDC 44/2009 para farmácia virtual, e o
  // que o rodapé da loja exibe. Fica no mesmo bloco do ramo porque é o ramo que
  // o torna obrigatório.
  const [farmacia, setFarmacia] = useState({
    farmaceuticoResponsavel: loja.farmaceuticoResponsavel ?? "",
    farmaceuticoCrf: loja.farmaceuticoCrf ?? "",
    licencaSanitaria: loja.licencaSanitaria ?? "",
    autorizacaoAnvisa: loja.autorizacaoAnvisa ?? "",
  });
  const [vitrine, setVitrine] = useState({ slogan: loja.slogan ?? "", logoUrl: loja.logoUrl ?? "", bannerUrl: loja.bannerUrl ?? "" });
  const [contato, setContato] = useState({ avisoTopo: loja.avisoTopo ?? "", whatsapp: loja.whatsapp ?? "", emailContato: loja.emailContato ?? "", dominioPrincipal: loja.dominioPrincipal ?? "" });
  const [jsonIdentidade, setJsonIdentidade] = useState("");
  const [erroJson, setErroJson] = useState<string | null>(null);

  const campanhas = tema.campanhasHome ?? [];
  function atualizarCampanha(indice: number, mudancas: Partial<NonNullable<TemaLoja["campanhasHome"]>[number]>) {
    setTema((atual) => {
      const novas = [...(atual.campanhasHome ?? [])];
      novas[indice] = { ...novas[indice], ...mudancas };
      return { ...atual, campanhasHome: novas };
    });
  }

  const voltar = () => router.push(caminho);
  const salvar = (corpo: unknown, msg: string) => chamar("/api/painel/loja", "PATCH", corpo, msg).then((d) => { if (d) voltar(); });

  function recriarMarca() {
    const nova = criarDirecaoVisual({
      segmento: identidade.segmento, publico: identidade.publico, diferencial: identidade.diferencial,
      personalidade: identidade.personalidade, tomDeVoz: identidade.tomDeVoz,
      objetivo: identidade.objetivo, estiloFotografico: identidade.estiloFotografico,
    }, loja.nome);
    setIdentidade(nova.identidade);
    setTema({ ...tema, corPrimaria: nova.tema.corPrimaria, modo: nova.tema.modo, fonte: nova.tema.fonte, raio: nova.tema.raio, layout: nova.tema.layout });
    setVitrine((v) => ({ ...v, slogan: v.slogan || nova.identidade.assinatura }));
  }

  // ── resumo ──────────────────────────────────────────────────────────────
  if (!bloco || !BLOCOS[bloco]) {
    const id = loja.identidade;
    const layout = LAYOUTS.find((l) => l.valor === loja.tema.layout)?.rotulo ?? loja.tema.layout;
    const faltaDirecao = !id.publico || !id.diferencial;
    const faltaVitrine = !loja.logoUrl;
    const faltaContato = !loja.whatsapp && !loja.emailContato;

    const cartoes: Array<{ bloco: Bloco; linha1: string; linha2?: string; pendente?: string; amostra?: React.ReactNode }> = [
      {
        bloco: "direcao",
        linha1: `${TOM[id.tomDeVoz] ?? id.tomDeVoz} · ${rotulo(SEGMENTOS, id.segmento)}`,
        linha2: id.diferencial ? `“${id.diferencial.slice(0, 110)}${id.diferencial.length > 110 ? "…" : ""}”` : undefined,
        pendente: faltaDirecao ? "Falta descrever público e diferencial" : undefined,
      },
      {
        bloco: "visual",
        linha1: `${FONTES.find((f) => f.valor === loja.tema.fonte)?.rotulo.split(" (")[0] ?? loja.tema.fonte} · cantos ${(RAIO[loja.tema.raio] ?? loja.tema.raio).toLowerCase()} · ${(MODO[loja.tema.modo] ?? loja.tema.modo).toLowerCase()}`,
        amostra: (
          <span className="flex gap-1" aria-label={`Cores ${loja.tema.corPrimaria} e ${id.corApoio}`}>
            <i className="h-4 w-4 rounded-full border border-border" style={{ background: loja.tema.corPrimaria }} />
            <i className="h-4 w-4 rounded-full border border-border" style={{ background: id.corApoio }} />
          </span>
        ),
      },
      {
        bloco: "vitrine",
        linha1: `Layout ${layout} · ${loja.logoUrl ? "logo" : "sem logo"} · ${loja.bannerUrl ? "banner" : "sem banner"}`,
        linha2: loja.slogan ? `“${loja.slogan}”` : undefined,
        pendente: faltaVitrine ? "Falta enviar a logo" : undefined,
      },
      {
        bloco: "contato",
        linha1: [loja.whatsapp ? "WhatsApp" : null, loja.emailContato ? "e-mail" : null, loja.dominioPrincipal ?? null].filter(Boolean).join(" · ") || "Nenhum canal informado",
        linha2: loja.avisoTopo ? `Aviso: “${loja.avisoTopo}”` : undefined,
        pendente: faltaContato ? "Falta um canal para o cliente falar com você" : undefined,
      },
    ];

    return (
      <div className="grid gap-3">
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {cartoes.map((c, i) => (
            <li key={c.bloco} className={i > 0 ? "border-t border-border" : undefined}>
              <Link href={`${caminho}?bloco=${c.bloco}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 transition active:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{BLOCOS[c.bloco].titulo}</span>
                    {c.pendente && <span className="h-2 w-2 flex-none rounded-full bg-amber-500" aria-hidden="true" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{c.linha1}</span>
                  {c.linha2 && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{c.linha2}</span>}
                  {c.pendente && <span className="mt-0.5 block text-xs text-amber-700">{c.pendente}</span>}
                </span>
                {c.amostra}
                <ChevronRight size={16} className="flex-none text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="px-1 text-xs text-muted-foreground">Toque num bloco para editar. Cada bloco salva sozinho.</p>
      </div>
    );
  }

  // ── edição de um bloco ──────────────────────────────────────────────────
  const cabecalho = (
    <Link href={caminho} className="-mt-1 mb-1 inline-flex h-11 items-center gap-1 pr-3 text-sm text-muted-foreground">
      <ChevronLeft size={16} aria-hidden="true" /> Marca
    </Link>
  );
  const rodape = (onSalvar: () => void, rotuloSalvar = "Salvar alterações") => (
    <div className="flex flex-wrap gap-2 pt-2">
      <button className="btn-primario" disabled={ocupado} onClick={onSalvar}>{rotuloSalvar}</button>
      <button className="btn-secundario" disabled={ocupado} onClick={voltar}>Cancelar</button>
    </div>
  );

  // A prévia sai do que está no formulário agora, não do que está salvo: é
  // para ver antes de gravar. O tema vai na URL e nada é guardado no servidor.
  const rascunho = codificarRascunho(tema);
  const verPrevia = (
    <p className="text-sm text-muted-foreground">
      {rascunho.length > LIMITE_RASCUNHO
        ? "Salve para ver este tema na loja."
        : <><a className="font-medium text-foreground underline" href={`/painel/previa?t=${rascunho}`} target="_blank" rel="noopener">Ver prévia</a> abre em outra aba, com produtos de demonstração. Nada é salvo.</>}
    </p>
  );

  if (bloco === "direcao") {
    return (
      <>
        {cabecalho}
        <Secao titulo={BLOCOS.direcao.titulo} descricao="Quem compra de você e por que escolhe a sua loja. É o que orienta o texto e a direção visual.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Segmento"><select className={inputClasse} value={identidade.segmento} onChange={(e) => setIdentidade({ ...identidade, segmento: e.target.value as IdentidadeLoja["segmento"] })}>{SEGMENTOS.map(([v, n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
            <Campo label="Tom de voz"><select className={inputClasse} value={identidade.tomDeVoz} onChange={(e) => setIdentidade({ ...identidade, tomDeVoz: e.target.value as IdentidadeLoja["tomDeVoz"] })}>{Object.entries(TOM).map(([v, n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
          </div>
          {/* Três linhas visíveis e cresce enquanto digita: o campo reservava a
              altura de um parágrafo inteiro para uma frase. */}
          <Campo label="Público" ajuda="Uma ou duas frases: quem é, o que procura."><textarea className={`${inputClasse} h-auto min-h-[5.5rem] py-2`} rows={3} value={identidade.publico} onChange={(e) => setIdentidade({ ...identidade, publico: e.target.value })} /></Campo>
          <Campo label="Diferencial" ajuda="Por que comprar de você e não do concorrente."><textarea className={`${inputClasse} h-auto min-h-[5.5rem] py-2`} rows={3} value={identidade.diferencial} onChange={(e) => setIdentidade({ ...identidade, diferencial: e.target.value })} /></Campo>
          <Campo label="Personalidade" ajuda="Até três. A primeira conduz a direção visual.">
            <div className="brand-choice-grid three">{PERSONALIDADES.map(([v, n]) => <button type="button" key={v} aria-pressed={identidade.personalidade.includes(v)} className={identidade.personalidade.includes(v) ? "selecionado" : ""} onClick={() => setIdentidade({ ...identidade, personalidade: identidade.personalidade.includes(v) ? (identidade.personalidade.length > 1 ? identidade.personalidade.filter((x) => x !== v) : identidade.personalidade) : [...identidade.personalidade, v].slice(-3) })}><strong>{n}</strong></button>)}</div>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Fotografia"><select className={inputClasse} value={identidade.estiloFotografico} onChange={(e) => setIdentidade({ ...identidade, estiloFotografico: e.target.value as IdentidadeLoja["estiloFotografico"] })}>{Object.entries(FOTO).map(([v, n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
            <Campo label="Objetivo"><select className={inputClasse} value={identidade.objetivo} onChange={(e) => setIdentidade({ ...identidade, objetivo: e.target.value as IdentidadeLoja["objetivo"] })}>{Object.entries(OBJETIVO).map(([v, n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
          </div>
          <div className="painel-brand-brief">
            <div><small>Assinatura sugerida</small><strong>{identidade.assinatura || "Preencha público e diferencial para gerar."}</strong></div>
            <div><small>Direção fotográfica</small><strong>{identidade.direcaoFotografica || "Escolha um estilo e gere a direção."}</strong></div>
          </div>
          <button type="button" className="btn-secundario w-fit" onClick={recriarMarca}>Gerar nova direção a partir disto</button>
          {rodape(() => salvar({ identidade, tema }, "Direção da marca salva."))}
        </Secao>
      </>
    );
  }

  if (bloco === "visual") {
    return (
      <>
        {cabecalho}
        <Secao titulo={BLOCOS.visual.titulo} descricao="O que dá a cara da loja. Troque e veja na loja na hora.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Cor principal"><div className="flex gap-2"><input type="color" aria-label="Escolher cor principal" value={tema.corPrimaria} onChange={(e) => setTema({ ...tema, corPrimaria: e.target.value })} className="h-11 w-14 rounded-lg border border-border" /><input className={inputClasse} value={tema.corPrimaria} onChange={(e) => setTema({ ...tema, corPrimaria: e.target.value })} /></div></Campo>
            <Campo label="Modo"><select className={inputClasse} value={tema.modo} onChange={(e) => setTema({ ...tema, modo: e.target.value as TemaLoja["modo"] })}>{Object.entries(MODO).map(([v, n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
            <Campo label="Fonte"><select className={inputClasse} value={tema.fonte} onChange={(e) => setTema({ ...tema, fonte: e.target.value as TemaLoja["fonte"] })}>{FONTES.map((f) => <option value={f.valor} key={f.valor}>{f.rotulo}</option>)}</select></Campo>
            <Campo label="Cantos"><select className={inputClasse} value={tema.raio} onChange={(e) => setTema({ ...tema, raio: e.target.value as TemaLoja["raio"] })}>{Object.entries(RAIO).map(([v, n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
          </div>
          {verPrevia}
          {rodape(() => salvar({ tema }, "Identidade visual salva."))}
        </Secao>
      </>
    );
  }

  if (bloco === "vitrine") {
    return (
      <>
        {cabecalho}
        <Secao titulo={BLOCOS.vitrine.titulo} descricao="Como a página inicial se monta.">
          <Campo label="Template da loja" ajuda="O Automotivo Premium personaliza toda a experiência, da navegação ao carrinho.">
            <div className="grid gap-2 sm:grid-cols-2">
              {LAYOUTS.map((l) => (
                <button key={l.valor} type="button" aria-pressed={tema.layout === l.valor} onClick={() => setTema({ ...tema, layout: l.valor })} className={`min-h-[44px] rounded-xl border p-3 text-left text-sm ${tema.layout === l.valor ? "border-foreground bg-muted" : "border-border"}`}>
                  <span className="block font-semibold">{l.rotulo}</span>
                  <span className="text-xs text-muted-foreground">{l.descricao}</span>
                </button>
              ))}
            </div>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Ramo da loja" ajuda="Peças para motos liga a garagem: o cliente escolhe a moto e vê só o que serve. Farmácia liga tarja, princípio ativo e o farmacêutico responsável no rodapé.">
              <select className={inputClasse} value={segmento} onChange={(e) => setSegmento(e.target.value)}>
                <option value="geral">Loja geral</option>
                <option value="motopecas">Peças e acessórios para motos</option>
                <option value="farmacia">Farmácia e drogaria</option>
              </select>
            </Campo>
            <Campo label="Categoria sem foto" ajuda="Vale para os atalhos da página inicial. No menu e no catálogo todas aparecem.">
              <select className={inputClasse} value={tema.categoriaSemImagem} onChange={(e) => setTema({ ...tema, categoriaSemImagem: e.target.value as TemaLoja["categoriaSemImagem"] })}>
                <option value="ocultar">Fica fora da página inicial</option>
                <option value="icone">Entra com um ícone</option>
              </select>
            </Campo>
            <Campo label="Slogan"><input className={inputClasse} value={vitrine.slogan} onChange={(e) => setVitrine({ ...vitrine, slogan: e.target.value })} /></Campo>
            <Campo label="Logo">
              <div className="flex items-center gap-2">
                <input className={inputClasse} value={vitrine.logoUrl} onChange={(e) => setVitrine({ ...vitrine, logoUrl: e.target.value })} placeholder="URL ou envie um arquivo" />
                <EnviarImagem aoEnviar={(url) => setVitrine((v) => ({ ...v, logoUrl: url }))} rotulo="Enviar logo" />
              </div>
            </Campo>
            <Campo label="Banner de reserva" ajuda="Imagem usada quando a loja ainda não tem campanhas no carrossel.">
              <div className="flex items-center gap-2">
                <input className={inputClasse} value={vitrine.bannerUrl} onChange={(e) => setVitrine({ ...vitrine, bannerUrl: e.target.value })} placeholder="URL ou envie um arquivo" />
                <EnviarImagem aoEnviar={(url) => setVitrine((v) => ({ ...v, bannerUrl: url }))} rotulo="Enviar banner" />
              </div>
            </Campo>
          </div>
          {(tema.layout === "distribuidora" || tema.layout === "automotivo") && <fieldset className="mt-6 grid gap-4 rounded-xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold">Carrossel de campanhas em imagem</legend>
            <p className="text-sm text-muted-foreground">A chamada e qualquer condição comercial devem estar dentro da arte. Use apenas preço e desconto aprovados para a campanha.</p>
            {campanhas.map((campanha, indice) => <div key={indice} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 sm:col-span-2">
                <strong className="text-sm">Arte {indice + 1}</strong>
                <EnviarImagem valorAtual={campanha.imagemUrl || null} aoEnviar={(url) => atualizarCampanha(indice, { imagemUrl: url })} rotulo={campanha.imagemUrl ? "Trocar arte" : "Enviar arte"} />
                <EnviarImagem valorAtual={campanha.imagemMobileUrl || null} aoEnviar={(url) => atualizarCampanha(indice, { imagemMobileUrl: url })} rotulo={campanha.imagemMobileUrl ? "Trocar arte móvel" : "Enviar arte móvel"} />
                <button type="button" className="ml-auto text-sm text-muted-foreground underline" onClick={() => setTema((atual) => ({ ...atual, campanhasHome: (atual.campanhasHome ?? []).filter((_, i) => i !== indice) }))}>Remover</button>
              </div>
              <Campo label="Destino do banner">
                <select className={inputClasse} value={campanha.link} onChange={(e) => atualizarCampanha(indice, { link: e.target.value })}>
                  <option value="/produtos">Todos os produtos</option>
                  {categorias.map((categoria) => <option key={categoria.slug} value={`/categoria/${categoria.slug}`}>{categoria.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Descrição acessível da imagem" ajuda="Texto para leitores de tela. Não aparece sobre o banner.">
                <input className={inputClasse} value={campanha.alt} maxLength={180} onChange={(e) => atualizarCampanha(indice, { alt: e.target.value })} />
              </Campo>
              {(campanha.imagemUrl || campanha.imagemMobileUrl) && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                {campanha.imagemUrl && <figure className="grid gap-1"><img className="max-h-56 w-full rounded-lg border border-border bg-muted object-contain" src={campanha.imagemUrl} alt="" /><figcaption className="text-xs text-muted-foreground">Prévia desktop</figcaption></figure>}
                {campanha.imagemMobileUrl && <figure className="grid gap-1"><img className="mx-auto max-h-72 rounded-lg border border-border bg-muted object-contain" src={campanha.imagemMobileUrl} alt="" /><figcaption className="text-center text-xs text-muted-foreground">Prévia móvel</figcaption></figure>}
              </div>}
            </div>)}
            {campanhas.length < 5 && <button type="button" className="btn-secundario w-fit" onClick={() => setTema((atual) => ({ ...atual, campanhasHome: [...(atual.campanhasHome ?? []), { imagemUrl: "", link: "/produtos", alt: "Campanha da loja" }] }))}>Adicionar arte</button>}
          </fieldset>}
          {tema.layout === "automotivo-premium" && <fieldset className="mt-6 grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
            <legend className="px-2 text-sm font-semibold">Conteúdo do Automotivo Premium</legend>
            {([
              ["heroSelo", "Assinatura acima do título"], ["heroTitulo", "Título do banner"],
              ["heroTexto", "Texto do banner"], ["buscaTitulo", "Pergunta da busca"],
              ["buscaExemplo", "Exemplo no campo de busca"], ["editorialTitulo", "Título da seção editorial"],
              ["editorialTexto", "Texto da seção editorial"], ["editorialImagemSecundaria", "Imagem editorial complementar"],
            ] as const).map(([chave, label]) => <Campo key={chave} label={label}><input className={inputClasse} value={tema.premium?.[chave] ?? ""} onChange={e => setTema({ ...tema, premium: { ...tema.premium, [chave]: e.target.value } })}/></Campo>)}
            <Campo label="Imagem editorial" ajuda="Imagem de contexto; não substitui fotos reais dos produtos."><div className="flex gap-2"><input className={inputClasse} value={tema.premium?.editorialImagem ?? ""} onChange={e => setTema({...tema,premium:{...tema.premium,editorialImagem:e.target.value || undefined}})}/><EnviarImagem aoEnviar={url => setTema(v => ({...v,premium:{...v.premium,editorialImagem:url}}))} rotulo="Enviar editorial"/></div></Campo>
            <Campo label="Logo para o modo escuro"><div className="flex gap-2"><input className={inputClasse} value={tema.premium?.logoEscuroUrl ?? ""} onChange={e => setTema({...tema,premium:{...tema.premium,logoEscuroUrl:e.target.value || undefined}})}/><EnviarImagem aoEnviar={url => setTema(v => ({...v,premium:{...v.premium,logoEscuroUrl:url}}))} rotulo="Enviar logo escuro"/></div></Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tema.premium?.mostrarNome ?? false} onChange={e => setTema({...tema,premium:{...tema.premium,mostrarNome:e.target.checked}})}/> Mostrar o nome ao lado do símbolo</label>
            <EditorEtapas etapas={tema.premium?.etapas ?? []} categorias={categorias} aoAlterar={etapas => setTema({...tema,premium:{...tema.premium,etapas}})}/>
          </fieldset>}
          {segmento === "farmacia" && (
            <fieldset className="mt-6 grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
              <legend className="px-2 text-sm font-semibold">Responsável técnico</legend>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Farmácia que dispensa a distância precisa exibir o farmacêutico responsável e o CRF
                (RDC 44/2009). Estes dados aparecem no rodapé de toda página da loja. Sem eles, o
                rodapé mostra apenas o aviso legal — nunca um nome que não foi informado.
              </p>
              <Campo label="Farmacêutico(a) responsável">
                <input className={inputClasse} value={farmacia.farmaceuticoResponsavel} onChange={(e) => setFarmacia({ ...farmacia, farmaceuticoResponsavel: e.target.value })} placeholder="Maria Souza" />
              </Campo>
              <Campo label="CRF">
                <input className={inputClasse} value={farmacia.farmaceuticoCrf} onChange={(e) => setFarmacia({ ...farmacia, farmaceuticoCrf: e.target.value })} placeholder="CRF-SP 12345" />
              </Campo>
              <Campo label="Licença sanitária" ajuda="Número do alvará da vigilância sanitária local.">
                <input className={inputClasse} value={farmacia.licencaSanitaria} onChange={(e) => setFarmacia({ ...farmacia, licencaSanitaria: e.target.value })} />
              </Campo>
              <Campo label="AFE (Anvisa)" ajuda="Autorização de Funcionamento de Empresa, se a loja tiver.">
                <input className={inputClasse} value={farmacia.autorizacaoAnvisa} onChange={(e) => setFarmacia({ ...farmacia, autorizacaoAnvisa: e.target.value })} />
              </Campo>
            </fieldset>
          )}
          {verPrevia}
          {rodape(() => salvar({ tema, segmento,
            ...(segmento === "farmacia" ? {
              farmaceuticoResponsavel: farmacia.farmaceuticoResponsavel.trim() || null,
              farmaceuticoCrf: farmacia.farmaceuticoCrf.trim() || null,
              licencaSanitaria: farmacia.licencaSanitaria.trim() || null,
              autorizacaoAnvisa: farmacia.autorizacaoAnvisa.trim() || null,
            } : {}),
            slogan: vitrine.slogan, ...(vitrine.logoUrl ? { logoUrl: vitrine.logoUrl } : {}), bannerUrl: vitrine.bannerUrl || null }, "Vitrine salva."))}
        </Secao>
      </>
    );
  }

  return (
    <>
      {cabecalho}
      <Secao titulo={BLOCOS.contato.titulo} descricao="Por onde o cliente fala com você, e o que a loja avisa no topo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="WhatsApp" ajuda="DDD e número."><input className={inputClasse} inputMode="tel" value={contato.whatsapp} onChange={(e) => setContato({ ...contato, whatsapp: e.target.value })} /></Campo>
          <Campo label="E-mail de contato"><input className={inputClasse} inputMode="email" value={contato.emailContato} onChange={(e) => setContato({ ...contato, emailContato: e.target.value })} /></Campo>
          <Campo label="Barra de avisos" ajuda="Uma linha acima do cabeçalho, em toda a loja. Vazio = não mostra."><input className={inputClasse} value={contato.avisoTopo} onChange={(e) => setContato({ ...contato, avisoTopo: e.target.value })} maxLength={120} /></Campo>
          <Campo label="Domínio próprio" ajuda="A verificação de DNS fica em Configurações › Domínio."><input className={inputClasse} value={contato.dominioPrincipal} onChange={(e) => setContato({ ...contato, dominioPrincipal: e.target.value })} placeholder="minhaloja.com.br" /></Campo>
        </div>
        {rodape(() => salvar({ ...Object.fromEntries(Object.entries(contato).filter(([k, v]) => k !== "avisoTopo" && v !== "")), avisoTopo: contato.avisoTopo.trim() || null }, "Contato salvo."))}

        <details className="mt-2 rounded-lg border border-border p-3 text-sm">
          <summary className="min-h-[44px] cursor-pointer leading-[44px] font-medium">Colar identidade pronta (JSON)</summary>
          <p className="mb-2 text-xs text-muted-foreground">Para quem monta a identidade fora daqui (designer, ChatGPT): cole o JSON do docs/IDENTIDADE-VISUAL.md.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea className={`${inputClasse} h-24 py-2 font-mono text-xs`} aria-label="JSON da identidade" value={jsonIdentidade} onChange={(e) => setJsonIdentidade(e.target.value)} placeholder='{"tema":{"corPrimaria":"#c62828","layout":"editorial"},"slogan":"…"}' />
            <button className="btn-secundario" disabled={ocupado || !jsonIdentidade.trim()} onClick={() => {
              let corpo: unknown;
              try { corpo = JSON.parse(jsonIdentidade); } catch { setErroJson("JSON inválido."); return; }
              setErroJson(null);
              salvar(corpo, "Identidade aplicada.").then(() => setJsonIdentidade(""));
            }}>Aplicar</button>
          </div>
          {erroJson && <p className="mt-2 text-xs text-red-700">{erroJson}</p>}
        </details>
      </Secao>
    </>
  );
}
