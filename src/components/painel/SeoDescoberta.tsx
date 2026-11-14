"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bot, CheckCircle2, Compass, Search, TriangleAlert } from "lucide-react";
import { Campo, inputClasse, Secao } from "./campos";
import type { EstadoDescoberta } from "@/lib/descoberta";
import { lerConfiguracaoSeo, metadadosSeo, orientacoesSeo, SeoConfiguracaoEntradaSchema, type ConfiguracaoSeo, type MetadadosSeo } from "@/lib/seo-config";

type Props = { estado: EstadoDescoberta; configuracao: ConfiguracaoSeo; automaticos: MetadadosSeo; podeEditar: boolean };

export default function SeoDescoberta({ estado, configuracao, automaticos, podeEditar }: Props) {
  const router = useRouter();
  const id = useId();
  const [config, setConfig] = useState(configuracao);
  const [treino, setTreino] = useState(estado.treinamentoIa);
  const [salvo, setSalvo] = useState({ configuracao, treino: estado.treinamentoIa });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const previa = metadadosSeo(config, automaticos);
  const orientacoes = orientacoesSeo(previa);
  const alterado = JSON.stringify({ configuracao: config, treino }) !== JSON.stringify(salvo);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    const entrada = SeoConfiguracaoEntradaSchema.safeParse(config);
    if (!entrada.success) { setErro("Revise os campos. Use texto sem HTML e um limite de 1 a 20 produtos."); return; }
    setSalvando(true);
    setErro(null);
    setMensagem("");
    try {
      const normalizada = lerConfiguracaoSeo(entrada.data);
      const alteracoes = Object.fromEntries(Object.entries(normalizada).filter(([chave, valor]) => valor !== salvo.configuracao[chave as keyof ConfiguracaoSeo]));
      const resposta = await fetch("/api/painel/loja", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ configuracaoSeo: alteracoes, ...(treino !== salvo.treino ? { permiteTreinamentoIa: treino } : {}) }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(typeof dados?.erro === "string" ? dados.erro : "Não foi possível salvar. Tente novamente.");
      }
      const dados = await resposta.json();
      const confirmada = lerConfiguracaoSeo(dados.configuracaoSeo);
      const treinamentoConfirmado = dados.permiteTreinamentoIa === true;
      setConfig(confirmada);
      setTreino(treinamentoConfirmado);
      setSalvo({ configuracao: confirmada, treino: treinamentoConfirmado });
      setMensagem("Alterações salvas.");
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error && falha.name !== "TypeError" ? falha.message : "Não foi possível salvar. Confira a conexão e tente novamente.");
    } finally { setSalvando(false); }
  }

  return <div className="grid min-w-0 gap-5" data-seo-lojas="1">
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Visão geral de SEO">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Compass size={23} aria-hidden="true" /></span>
          <div><p className="text-xs font-semibold tracking-widest text-muted-foreground">LOJAS • SEO</p><h2 className="mt-1 text-lg font-semibold">Sua loja, bem apresentada.</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Cuide de como a loja se apresenta nas buscas e nos resumos para assistentes de IA.</p></div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estado.indexavel ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{estado.indexavel ? "Configuração de busca ativa" : "Publicação aguardando ativação"}</span>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">Endereço oficial</dt><dd className="mt-1 break-all font-medium">{estado.dominioCanonico}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Google e Bing</dt><dd className="mt-1 font-medium">{estado.busca.google ? "Rastreamento permitido" : "Rastreamento bloqueado"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Busca do ChatGPT</dt><dd className="mt-1 font-medium">{estado.busca.chatgpt ? "Rastreamento permitido" : "Rastreamento bloqueado"}</dd></div>
      </dl>
    </section>

    {!podeEditar && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Seu acesso permite consultar esta configuração. Donos e gerentes podem alterá-la.</p>}

    <form onSubmit={salvar} className="grid min-w-0 gap-5">
      <fieldset disabled={!podeEditar || salvando} className="grid min-w-0 gap-5">
        <legend className="sr-only">Configurações de SEO e descoberta</legend>
        <Secao titulo="Aparência nas buscas" descricao="Personalize a apresentação da página inicial. Deixe em branco para usar o conteúdo automático da loja.">
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <div className="grid content-start gap-4">
              <Campo label="Título da página inicial" ajuda={`${Array.from(config.tituloInicio).length}/120 caracteres • prefira um título descritivo e conciso.`}>
                <input className={inputClasse} maxLength={120} value={config.tituloInicio} placeholder={automaticos.titulo} onChange={e => setConfig({ ...config, tituloInicio: e.target.value })} />
              </Campo>
              <Campo label="Descrição da página inicial" ajuda={`${Array.from(config.descricaoInicio).length}/320 caracteres • resuma o que a pessoa encontra na loja.`}>
                <textarea className={`${inputClasse} h-auto min-h-28 py-3`} rows={4} maxLength={320} value={config.descricaoInicio} placeholder={automaticos.descricao} onChange={e => setConfig({ ...config, descricaoInicio: e.target.value })} />
              </Campo>
              <button type="button" className="w-fit text-sm font-medium text-primary underline underline-offset-4" onClick={() => setConfig({ ...config, tituloInicio: "", descricaoInicio: "" })}>Usar título e descrição automáticos</button>
            </div>
            <div className="min-w-0 rounded-xl border border-border bg-background p-4">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Search size={15} aria-hidden="true" /> PRÉVIA DA PÁGINA INICIAL</p>
              <div className="break-all text-xs text-muted-foreground">{estado.dominioCanonico}</div>
              <p className="mt-2 break-words text-xl leading-snug text-blue-800" data-seo-previa-titulo>{previa.titulo}</p>
              <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground" data-seo-previa-descricao>{previa.descricao}</p>
              <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">Prévia ilustrativa. Os buscadores podem escolher outro título ou trecho conforme a pesquisa.</p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Orientações de redação">
            {orientacoes.map(item => <li key={item.id} className="flex gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              {item.estado === "ok" ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /> : <TriangleAlert size={17} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />}
              <div><p className="font-medium">{item.titulo}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.texto}</p></div>
            </li>)}
          </ul>
        </Secao>

        <Secao titulo="Resumo para assistentes de IA" descricao="O Lojas organiza as informações públicas da sua loja e mantém os resumos atualizados automaticamente.">
          <div className="flex gap-3 rounded-xl bg-muted/50 p-4 text-sm"><Bot size={22} className="shrink-0 text-primary" aria-hidden="true" /><p className="leading-relaxed text-muted-foreground">Escolha como os destaques aparecem no resumo. Categorias, contato, políticas e links do catálogo continuam vindo dos dados publicados da loja.</p></div>
          <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" aria-labelledby={`${id}-destaques`} aria-describedby={`${id}-destaques-ajuda`} className="mt-0.5 size-5 shrink-0 accent-primary" checked={config.incluirDestaques} onChange={e => setConfig({ ...config, incluirDestaques: e.target.checked })} /><span><span id={`${id}-destaques`} className="font-medium">Incluir produtos de destaque no resumo</span><span id={`${id}-destaques-ajuda`} className="mt-1 block text-xs text-muted-foreground">Usa os produtos que você já marcou como destaque no catálogo.</span></span></label>
          <div className="max-w-xs"><Campo label="Quantidade máxima de destaques" ajuda="De 1 a 20 produtos no resumo. O catálogo completo permanece disponível."><input className={inputClasse} type="number" min={1} max={20} step={1} disabled={!config.incluirDestaques || !podeEditar || salvando} value={config.limiteDestaques} onChange={e => setConfig({ ...config, limiteDestaques: Number(e.target.value) })} /></Campo></div>
        </Secao>

        <Secao titulo="Treinamento de modelos de IA" descricao="Uma escolha independente da busca e da publicação dos resumos.">
          <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" aria-labelledby={`${id}-treinamento`} aria-describedby={`${id}-treinamento-ajuda`} className="mt-0.5 size-5 shrink-0 accent-primary" checked={treino} onChange={e => setTreino(e.target.checked)} /><span><span id={`${id}-treinamento`} className="font-medium">Permitir o uso do conteúdo público para treinamento de IA</span><span id={`${id}-treinamento-ajuda`} className="mt-1 block text-xs leading-relaxed text-muted-foreground">Libera os robôs de treinamento, como GPTBot e Google-Extended. Não altera as permissões de busca do Google, Bing ou ChatGPT. Desligado por padrão.</span></span></label>
        </Secao>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <button type="submit" className="btn-primario" disabled={!podeEditar || salvando || !alterado}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
        <p className="text-sm text-muted-foreground" role="status">{mensagem || (alterado ? "Há alterações ainda não salvas." : "Configurações atualizadas.")}</p>
        {erro && <p className="basis-full text-sm text-red-700" role="alert">{erro}</p>}
      </div>
    </form>

    <Secao titulo="Documentos públicos da loja" descricao="Abra os documentos que os buscadores e assistentes podem consultar.">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Mapa do site", "Páginas públicas para descoberta", estado.sitemap],
          ["Resumo para IA", "Apresentação e principais links da loja", estado.llms],
          ["Conteúdo completo para IA", "Catálogo publicado em texto", estado.llms.replace(/llms\.txt$/, "llms-full.txt")],
          ["Catálogo para agentes", "Recursos públicos organizados", new URL("/.well-known/ard.json", estado.sitemap).href],
        ].map(([titulo, detalhe, href]) => <a key={titulo} href={href} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"><span><span className="block text-sm font-semibold">{titulo}</span><span className="mt-1 block text-xs text-muted-foreground">{detalhe}</span></span><ArrowUpRight size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" /></a>)}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">A configuração permite o rastreamento do conteúdo público. A presença nos resultados depende de cada buscador.</p>
    </Secao>
  </div>;
}
