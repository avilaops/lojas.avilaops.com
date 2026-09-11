"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LAYOUTS, type TemaLoja } from "@/lib/tema";
import { criarDirecaoVisual, PERSONALIDADES, SEGMENTOS, type IdentidadeLoja } from "@/lib/identidade";
import { Campo, FONTES, Secao, brl, inputClasse, lerCsvProdutos } from "./campos";
import EnviarImagem from "./EnviarImagem";
import Cupons, { type CupomView } from "./Cupons";
import Categorias, { type CategoriaView } from "./Categorias";
import AvaliacoesPainel, { type AvaliacaoPainelView } from "./AvaliacoesPainel";
import Buscadores from "./Buscadores";
import Vendas from "./Vendas";
import type { ResumoVendas } from "@/lib/relatorio";
import type { DiagnosticoFeed } from "@/lib/catalogo";
import Anuncios, { type PixelsView } from "./Anuncios";
import McpPainel from "./McpPainel";
import CatalogoLista from "./CatalogoLista";
import SoltarPlanilha from "./SoltarPlanilha";
import { FileCheck2 } from "lucide-react";
import Inventario from "./Inventario";
import Pedidos from "./Pedidos";
import NovoProduto from "./NovoProduto";

export interface LojaView {
  slug: string;
  nome: string;
  url: string;
  status: string;
  plano: string;
  tema: TemaLoja;
  identidade: IdentidadeLoja;
  segmento: string;
  slogan: string | null;
  logoUrl: string | null;
  whatsapp: string | null;
  emailContato: string | null;
  avisoTopo: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
  dominioPrincipal: string | null;
  bannerUrl: string | null;
  mpPublicKey: string | null;
  emailRemetente: string | null;
  provisionamento: Record<string, string>;
  pixels: PixelsView;
  freteGratisAcima: number | null;
  retiradaNaLoja: boolean;
  despachoDiasUteis: number;
  estoqueBaixoEm: number;
  tabelaFrete: Array<{ ufs: string[]; preco: number; prazoDiasUteis: number; nome?: string }>;
  /** Já tem credencial salva: o checkout aparece na loja. */
  mpConfigurado: boolean;
  assinatura: { status: string; isenta: boolean; precoCentavos: number; planoNome: string; ultimoPagamentoEm: string | null; setupPagoEm: string | null; criadoEm: string; faturas: Array<{ id: string; centavos: number; status: string; pagaEm: string | null; criadoEm: string }> };
}
export interface EnderecoEntregaView { logradouro: string; numero: string; complemento?: string | null; bairro: string; cidade: string; uf: string; cep: string }
export interface PedidoView { id: string; numero: number; referencia: string; status: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; clienteDocumento: string; totalCentavos: number; subtotalCentavos: number; freteCentavos: number; descontoCentavos: number; cupomCodigo: string | null; meioPagamento: string; freteNome: string; rastreio: string | null; entrega: EnderecoEntregaView | null; etiqueta: { status: string; codigoObjeto: string | null; pdf: string | null; custoCentavos: number } | null; criadoEm: string; itens: Array<{ nome: string; quantidade: number; sku: string | null; precoUnitarioCentavos: number }> }

const STATUS: Record<string, string> = { ATIVA: "No ar", PROVISIONANDO: "Configurando", SUSPENSA: "Suspensa", CANCELADA: "Cancelada" };
/**
 * Cada seção é um endereço.
 *
 * Eram treze abas numa tira só, e a navegação inteira morava num useState: o
 * lojista não conseguia voltar, recarregar caía sempre na "Visão geral" e o
 * link que ele mandava para mim abria a tela errada. O menu agora é a barra
 * lateral (NavPainel) e esta tabela é o que liga o nome da seção à rota.
 */
export const ROTA_DA_SECAO = {
  "Visão geral": "/painel",
  "Pedidos": "/painel/pedidos",
  "Produtos": "/painel/produtos",
  "Categorias": "/painel/produtos/categorias",
  "Inventário": "/painel/estoque",
  "Cupons": "/painel/promocoes",
  "Avaliações": "/painel/avaliacoes",
  "Buscadores": "/painel/marketing",
  "Anúncios": "/painel/marketing/anuncios",
  "IA (Claude)": "/painel/ia",
  "Marca": "/painel/configuracoes/marca",
  "Entrega": "/painel/configuracoes/entrega",
  "Recebimento": "/painel/configuracoes/recebimento",
  "Assinatura": "/painel/configuracoes/assinatura",
  "Conta": "/painel/configuracoes/conta",
} as const;

export type SecaoPainel = keyof typeof ROTA_DA_SECAO;
const ASSINATURA: Record<string, { rotulo: string; classe: string }> = {
  SEM_ASSINATURA: { rotulo: "Período de teste", classe: "bg-amber-100 text-amber-800" },
  PENDENTE: { rotulo: "Aguardando cartão", classe: "bg-amber-100 text-amber-800" },
  AUTORIZADA: { rotulo: "Ativa", classe: "bg-emerald-100 text-emerald-800" },
  PAUSADA: { rotulo: "Pausada", classe: "bg-red-100 text-red-800" },
  CANCELADA: { rotulo: "Cancelada", classe: "bg-red-100 text-red-800" },
};

export default function PainelLoja({ secao, loja, contagens, cupons, categorias, avaliacoes, vendas, catalogo, espera, postagem }: { secao: SecaoPainel; loja: LojaView; contagens: { semEmbalagem: number; ativos: number; semFoto: number; pedidos: number }; cupons: CupomView[]; categorias: CategoriaView[]; avaliacoes: AvaliacaoPainelView[]; vendas: ResumoVendas; catalogo: DiagnosticoFeed; espera: Array<{ produto: string; pessoas: number }>; postagem: { etiquetas: number; custoCentavos: number; limiteCentavos: number } }) {
  const router = useRouter();
  // A seção vem da URL, não do estado: quem manda na tela é o endereço.
  const aba = secao;
  const irPara = (s: SecaoPainel) => router.push(ROTA_DA_SECAO[s]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function chamar(caminho: string, method: string, body?: unknown, sucesso = "Salvo.") {
    setErro(null); setOk(null); setOcupado(true);
    try {
      const r = await fetch(caminho, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? "Falha.");
      setOk(sucesso); router.refresh(); return d;
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha inesperada."); } finally { setOcupado(false); }
  }

  // ── estado dos formulários ──
  const [novo, setNovo] = useState({ nome: "", preco: "", precoDe: "", categoria: "", sku: "", descricaoCurta: "", imagem: "", destaque: false, pesoKg: "", estoque: "" });
  const [csv, setCsv] = useState<{ nome: string; produtos: Array<Record<string, unknown>>; erros: string[] } | null>(null);
  const [tema, setTema] = useState({ corPrimaria: loja.tema.corPrimaria, modo: loja.tema.modo, fonte: loja.tema.fonte, raio: loja.tema.raio, layout: loja.tema.layout, categoriaSemImagem: loja.tema.categoriaSemImagem });
  const [segmento, setSegmento] = useState(loja.segmento);
  const [identidade, setIdentidade] = useState(loja.identidade);
  const [limiteEstoque, setLimiteEstoque] = useState(String(loja.estoqueBaixoEm));
  const [empresa, setEmpresa] = useState({ razaoSocial: loja.razaoSocial ?? "", cnpj: loja.cnpj ?? "" });
  const [contato, setContato] = useState({ avisoTopo: loja.avisoTopo ?? "", slogan: loja.slogan ?? "", whatsapp: loja.whatsapp ?? "", emailContato: loja.emailContato ?? "", logoUrl: loja.logoUrl ?? "", bannerUrl: loja.bannerUrl ?? "", dominioPrincipal: loja.dominioPrincipal ?? "" });
  const [entrega, setEntrega] = useState({ retiradaNaLoja: loja.retiradaNaLoja, despachoDiasUteis: loja.despachoDiasUteis, freteGratisAcima: loja.freteGratisAcima != null ? String(loja.freteGratisAcima / 100).replace(".", ",") : "", tabela: loja.tabelaFrete.map((f) => ({ ufs: f.ufs.join(","), preco: String(f.preco / 100).replace(".", ","), prazo: String(f.prazoDiasUteis), nome: f.nome ?? "" })) });
  const [mp, setMp] = useState({ publicKey: loja.mpPublicKey ?? "", accessToken: "", webhookSecret: "" });
  // Diagnóstico do recebimento: credencial errada só dava erro na primeira
  // venda, com o comprador esperando. Aqui o lojista confere antes.
  const [diagnostico, setDiagnostico] = useState<{ ok: boolean; mensagem: string; conta?: { apelido: string | null; email: string | null }; avisos: string[] } | null>(null);
  const [senha, setSenha] = useState({ atual: "", nova: "" });
  const [jsonIdentidade, setJsonIdentidade] = useState("");

  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);

  function recriarMarca() {
    const nova = criarDirecaoVisual({
      segmento: identidade.segmento, publico: identidade.publico, diferencial: identidade.diferencial,
      personalidade: identidade.personalidade, tomDeVoz: identidade.tomDeVoz,
      objetivo: identidade.objetivo, estiloFotografico: identidade.estiloFotografico,
    }, loja.nome);
    setIdentidade(nova.identidade);
    setTema({ corPrimaria: nova.tema.corPrimaria, modo: nova.tema.modo, fonte: nova.tema.fonte, raio: nova.tema.raio, layout: nova.tema.layout, categoriaSemImagem: nova.tema.categoriaSemImagem });
    setContato((c) => ({ ...c, slogan: c.slogan || nova.identidade.assinatura }));
    setOk("Nova direção gerada. Revise e salve para publicar.");
  }

  function salvarProduto() {
    const preco = centavos(novo.preco);
    if (!novo.nome.trim() || !Number.isFinite(preco)) return setErro("Nome e preço são obrigatórios.");
    const precoDe = novo.precoDe ? centavos(novo.precoDe) : undefined;
    chamar("/api/painel/produtos", "PUT", [{
      nome: novo.nome, precoCentavos: preco, ...(precoDe && Number.isFinite(precoDe) ? { precoDeCentavos: precoDe } : {}),
      categoria: novo.categoria || undefined, sku: novo.sku || undefined, descricaoCurta: novo.descricaoCurta || undefined,
      imagens: novo.imagem ? [novo.imagem] : undefined, destaque: novo.destaque, ...(novo.pesoKg ? { pesoKg: Number.parseFloat(novo.pesoKg.replace(",", ".")) } : {}), ...(novo.estoque.trim() ? { estoque: Number(novo.estoque) } : {}),
    }], "Produto salvo.").then(() => setNovo({ nome: "", preco: "", precoDe: "", categoria: "", sku: "", descricaoCurta: "", imagem: "", destaque: false, pesoKg: "", estoque: "" }));
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${loja.status === "ATIVA" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{STATUS[loja.status] ?? loja.status}</span>
        <span className="text-muted-foreground">Plano {loja.plano.replace("_", " ")}</span>
        {loja.emailRemetente && <span className="text-muted-foreground">e-mail: {loja.emailRemetente}</span>}
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}


      {aba === "Visão geral" && (
        <div className="painel-overview">
          <Vendas r={vendas} espera={espera} irPara={irPara} />

          {/* O painel responde o que precisa de acao, nao explica a plataforma.
              Havia aqui um bloco institucional ("Sua marca esta no ar. Cuide
              primeiro do que o cliente percebe...") maior que o resumo de
              vendas inteiro: quem ja entrou no painel nao precisa que lhe
              vendam o painel. */}
          <section className="painel-next">
            <div>
              <small>Próximo passo</small>
              <h3>
                {!loja.logoUrl
                  ? "Envie o símbolo da sua marca"
                  : !loja.bannerUrl
                    ? "Crie a imagem principal da vitrine"
                    : contagens.semFoto > 0
                      ? `${contagens.semFoto.toLocaleString("pt-BR")} produtos sem foto`
                      : contagens.semEmbalagem > 0
                        ? `${contagens.semEmbalagem.toLocaleString("pt-BR")} produtos sem medida para o frete`
                        : "Está tudo em ordem por aqui"}
              </h3>
            </div>
            {(!loja.logoUrl || !loja.bannerUrl || contagens.semFoto > 0 || contagens.semEmbalagem > 0) && (
              <button
                className="btn-secundario"
                onClick={() => irPara(!loja.logoUrl || !loja.bannerUrl ? "Marca" : "Produtos")}
              >
                Resolver
              </button>
            )}
          </section>

          <div className="painel-metricas">
            <button onClick={() => irPara("Produtos")}>
              <small>Catálogo</small>
              <strong>{contagens.ativos.toLocaleString("pt-BR")}</strong>
              <span>{contagens.ativos ? "Ver produtos →" : "Cadastrar o primeiro →"}</span>
            </button>
            <button onClick={() => irPara("Pedidos")}>
              <small>Pedidos</small>
              <strong>{contagens.pedidos.toLocaleString("pt-BR")}</strong>
              <span>Ver pedidos →</span>
            </button>
            <a href={loja.url} target="_blank" rel="noopener">
              <small>Sua loja</small>
              <strong>{loja.status === "ATIVA" ? "No ar" : "Em preparação"}</strong>
              <span>Abrir loja ↗</span>
            </a>
          </div>
        </div>
      )}

      {aba === "Produtos" && (
        <>
          {/* Um aviso, não uma lista.
              Isto abria a aba com doze produtos e doze links "medir embalagem",
              empurrando o catálogo para baixo toda vez. Numa loja com 5.589
              produtos sem medida, doze exemplos não ajudam a decidir nada: o
              número decide, e quem quiser trabalhar nisso usa o filtro. */}
          {contagens.semEmbalagem > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-amber-50/60 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <b>{contagens.semEmbalagem.toLocaleString("pt-BR")} produtos sem medida</b>{" "}
                <span className="text-muted-foreground">
                  pagam frete pela caixa padrão da loja, quase sempre mais caro que o real.
                </span>
              </span>
            </p>
          )}
          {/* A listagem carrega do banco com busca, filtro e página: antes
              vinham os 500 primeiros por nome, e num catálogo de 5.591 itens o
              lojista não enxergava 91% do que vende. */}
          <CatalogoLista categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))} chamar={chamar} ocupado={ocupado} />

          {/* Cadastro sob demanda, com so o essencial a vista. Antes eram
              nove campos abertos de uma vez, todos com o mesmo peso, e o
              lojista rolava oito deles antes de achar o botao de salvar. */}
          <Secao titulo="Adicionar produto" descricao="Um de cada vez, ou a planilha inteira de uma vez.">
            <NovoProduto
              valor={novo}
              aoMudar={setNovo}
              aoSalvar={salvarProduto}
              ocupado={ocupado}
              categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))}
            />
          </Secao>

          <Secao titulo="Importar planilha" descricao="Produto com o mesmo SKU é atualizado, não duplicado.">
            <p className="text-xs text-muted-foreground">Colunas: <code>nome, preco, categoria, marca, sku, gtin, preco_de, descricao_curta, descricao, imagem, destaque, peso_kg</code></p>
            <SoltarPlanilha
              desabilitado={ocupado}
              onArquivo={(a) => a.text().then((t) => setCsv({ nome: a.name, ...lerCsvProdutos(t) }))}
            />
            {csv && (
              <div className="rounded-lg border border-border p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <FileCheck2 size={16} className="flex-none text-emerald-600" aria-hidden="true" />
                  <strong>{csv.nome}</strong>
                  <span className="text-muted-foreground">
                    {csv.produtos.length.toLocaleString("pt-BR")} produto(s) prontos para importar
                  </span>
                </p>
                {/* O erro aparece antes de importar, e não depois: planilha de
                    fornecedor quase sempre tem linha torta, e descobrir isso
                    com metade do catálogo gravado é pior. */}
                {csv.erros.length > 0 && (
                  <div className="mt-2 rounded-lg bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-900">
                      {csv.erros.length} linha(s) com problema serão ignoradas:
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
                      {csv.erros.slice(0, 5).map((x) => <li key={x}>{x}</li>)}
                      {csv.erros.length > 5 && <li>e mais {csv.erros.length - 5}.</li>}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn-primario"
                    disabled={ocupado || !csv.produtos.length}
                    onClick={() => chamar("/api/painel/produtos", "PUT", csv.produtos, "Produtos importados.").then(() => setCsv(null))}
                  >
                    Importar {csv.produtos.length.toLocaleString("pt-BR")} produto(s)
                  </button>
                  <button className="btn-secundario px-4" disabled={ocupado} onClick={() => setCsv(null)}>
                    Escolher outra
                  </button>
                </div>
              </div>
            )}
          </Secao>


        </>
      )}

      {aba === "Categorias" && <Categorias categorias={categorias} chamar={chamar} ocupado={ocupado} />}

      {aba === "Inventário" && (
        <>
          {/* A lista vem primeiro: a tarefa da tela é achar um item e ajustar.
              O aviso de estoque baixo é ajuste raro e vai para o fim — antes
              ele ocupava a primeira tela inteira do celular. */}
          <Inventario chamar={chamar} ocupado={ocupado} />

          <Secao titulo="Avisar quando estiver acabando" descricao="Abaixo desta quantidade a loja mostra “últimas unidades” para o comprador, e o produto aparece em Acabando. Zero desliga o aviso.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Avisar a partir de quantas unidades">
                <input
                  className={inputClasse}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={limiteEstoque}
                  onChange={(e) => setLimiteEstoque(e.target.value)}
                />
              </Campo>
            </div>
            <div>
              <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", { estoqueBaixoEm: Number(limiteEstoque) || 0 }, "Aviso ajustado.")}>
                Salvar
              </button>
            </div>
          </Secao>
        </>
      )}

      {aba === "Cupons" && <Cupons cupons={cupons} chamar={chamar} ocupado={ocupado} />}

      {aba === "Avaliações" && <AvaliacoesPainel avaliacoes={avaliacoes} chamar={chamar} ocupado={ocupado} />}

      {aba === "Buscadores" && <Buscadores chamar={chamar} ocupado={ocupado} />}

      {aba === "Anúncios" && <Anuncios pixels={loja.pixels} catalogo={catalogo} feedUrl={`${loja.url}/feed/merchant.xml`} chamar={chamar} ocupado={ocupado} />}

      {aba === "IA (Claude)" && <McpPainel lojaPlano={loja.plano} lojaSlug={loja.slug} aoIrParaAssinatura={() => irPara("Assinatura")} />}

      {aba === "Pedidos" && (
        <>
        {postagem.etiquetas > 0 && (
          <Secao titulo="Postagem a acertar" descricao="A Avila Ops adianta o valor da etiqueta e recebe depois. Quem decide se o frete é grátis ou cobrado do comprador é você | o adiantamento é o mesmo.">
            <p className="text-sm">
              <b>{brl(postagem.custoCentavos)}</b> em {postagem.etiquetas} etiqueta(s) emitida(s).
              {postagem.limiteCentavos > 0 && ` Seu limite é ${brl(postagem.limiteCentavos)}.`}
            </p>
            {postagem.limiteCentavos > 0 && postagem.custoCentavos >= postagem.limiteCentavos * 0.8 && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Você está perto do limite. Chegando nele, novas etiquetas param até o acerto.
              </p>
            )}
          </Secao>
        )}
        {/* Lista com busca, filtro e uma acao principal por pedido. Antes
            eram sete colunas com ate quatro botoes de 36px na ultima. */}
        <Pedidos chamar={chamar} ocupado={ocupado} />
        </>
      )}

      {aba === "Marca" && (
        <Secao titulo="Direção de marca" descricao="A essência orienta a identidade visual. Você pode regenerar a direção e ainda ajustar os detalhes antes de publicar.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Segmento"><select className={inputClasse} value={identidade.segmento} onChange={(e) => setIdentidade({ ...identidade, segmento: e.target.value as IdentidadeLoja["segmento"] })}>{SEGMENTOS.map(([v,n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
            <Campo label="Tom de voz"><select className={inputClasse} value={identidade.tomDeVoz} onChange={(e) => setIdentidade({ ...identidade, tomDeVoz: e.target.value as IdentidadeLoja["tomDeVoz"] })}><option value="direto">Direto</option><option value="proximo">Próximo</option><option value="especialista">Especialista</option><option value="inspirador">Inspirador</option></select></Campo>
          </div>
          <Campo label="Público"><textarea className={`${inputClasse} h-20 py-2`} value={identidade.publico} onChange={(e) => setIdentidade({ ...identidade, publico: e.target.value })} /></Campo>
          <Campo label="Diferencial"><textarea className={`${inputClasse} h-20 py-2`} value={identidade.diferencial} onChange={(e) => setIdentidade({ ...identidade, diferencial: e.target.value })} /></Campo>
          <Campo label="Personalidade" ajuda="A primeira opção selecionada conduz a direção visual.">
            <div className="brand-choice-grid three">{PERSONALIDADES.map(([v,n]) => <button type="button" key={v} className={identidade.personalidade.includes(v) ? "selecionado" : ""} onClick={() => setIdentidade({ ...identidade, personalidade: identidade.personalidade.includes(v) ? (identidade.personalidade.length > 1 ? identidade.personalidade.filter((x) => x !== v) : identidade.personalidade) : [...identidade.personalidade, v].slice(-3) })}><strong>{n}</strong></button>)}</div>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Fotografia"><select className={inputClasse} value={identidade.estiloFotografico} onChange={(e) => setIdentidade({ ...identidade, estiloFotografico: e.target.value as IdentidadeLoja["estiloFotografico"] })}><option value="produto">Produto</option><option value="editorial">Editorial</option><option value="lifestyle">Em uso</option><option value="natural">Natural</option><option value="tecnico">Técnica</option></select></Campo>
            <Campo label="Objetivo"><select className={inputClasse} value={identidade.objetivo} onChange={(e) => setIdentidade({ ...identidade, objetivo: e.target.value as IdentidadeLoja["objetivo"] })}><option value="vender">Vender</option><option value="posicionar">Posicionar</option><option value="captar">Captar contatos</option><option value="lancar">Lançar novidade</option></select></Campo>
          </div>
          <button type="button" className="btn-secundario w-fit" onClick={recriarMarca}>Gerar nova direção</button>
          <div className="painel-brand-brief">
            <div><small>Assinatura sugerida</small><strong>{identidade.assinatura || "Preencha público e diferencial para gerar."}</strong></div>
            <div><small>Direção fotográfica</small><strong>{identidade.direcaoFotografica || "Escolha um estilo e gere a direção."}</strong></div>
            <div><small>Paleta</small><p><i style={{ background: tema.corPrimaria }} /><i style={{ background: identidade.corApoio }} /></p></div>
          </div>
          <hr className="border-border" />
          <h3 className="text-sm font-semibold">Refinamento visual</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Cor principal"><div className="flex gap-2"><input type="color" value={tema.corPrimaria} onChange={(e) => setTema({ ...tema, corPrimaria: e.target.value })} className="h-11 w-14 rounded-lg border border-border" /><input className={inputClasse} value={tema.corPrimaria} onChange={(e) => setTema({ ...tema, corPrimaria: e.target.value })} /></div></Campo>
            <Campo label="Modo"><select className={inputClasse} value={tema.modo} onChange={(e) => setTema({ ...tema, modo: e.target.value as "claro" | "escuro" })}><option value="claro">Claro</option><option value="escuro">Escuro</option></select></Campo>
            <Campo label="Fonte"><select className={inputClasse} value={tema.fonte} onChange={(e) => setTema({ ...tema, fonte: e.target.value as typeof tema.fonte })}>{FONTES.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}</select></Campo>
            <Campo label="Cantos"><select className={inputClasse} value={tema.raio} onChange={(e) => setTema({ ...tema, raio: e.target.value as typeof tema.raio })}><option value="reto">Retos</option><option value="suave">Suaves</option><option value="redondo">Redondos</option></select></Campo>
            <Campo label="Categoria sem foto" ajuda="Vale para os atalhos e departamentos da página inicial. No menu e no catálogo todas aparecem.">
              <select className={inputClasse} value={tema.categoriaSemImagem} onChange={(e) => setTema({ ...tema, categoriaSemImagem: e.target.value as typeof tema.categoriaSemImagem })}>
                <option value="ocultar">Fica fora da página inicial</option>
                <option value="icone">Entra com um ícone</option>
              </select>
            </Campo>
          </div>
          <Campo label="Ramo da loja" ajuda="Peças e acessórios para motos liga a garagem: o cliente escolhe a moto e a loja mostra só o que serve. A compatibilidade é cadastrada em cada produto.">
            <select className={inputClasse} value={segmento} onChange={(e) => setSegmento(e.target.value)}>
              <option value="geral">Loja geral</option>
              <option value="motopecas">Peças e acessórios para motos</option>
            </select>
          </Campo>
          <Campo label="Layout da página inicial" ajuda="Composições prontas dos mesmos blocos. Troque e veja na loja na hora.">
            <div className="grid gap-2 sm:grid-cols-2">
              {LAYOUTS.map((l) => (
                <button key={l.valor} type="button" onClick={() => setTema({ ...tema, layout: l.valor })} className={`rounded-xl border p-3 text-left text-sm ${tema.layout === l.valor ? "border-primary" : "border-border"}`}>
                  <span className="block font-semibold">{l.rotulo}</span>
                  <span className="text-xs text-muted-foreground">{l.descricao}</span>
                </button>
              ))}
            </div>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Slogan"><input className={inputClasse} value={contato.slogan} onChange={(e) => setContato({ ...contato, slogan: e.target.value })} /></Campo>
            <Campo label="Banner da página inicial" ajuda="Imagem larga (ex.: 1600×600). Fica atrás do slogan.">
              <div className="flex items-center gap-2">
                <input className={inputClasse} value={contato.bannerUrl} onChange={(e) => setContato({ ...contato, bannerUrl: e.target.value })} placeholder="URL ou envie um arquivo" />
                <EnviarImagem aoEnviar={(url) => setContato((c) => ({ ...c, bannerUrl: url }))} rotulo="Enviar banner" />
              </div>
            </Campo>
            <Campo label="Logo">
              <div className="flex items-center gap-2">
                <input className={inputClasse} value={contato.logoUrl} onChange={(e) => setContato({ ...contato, logoUrl: e.target.value })} placeholder="URL ou envie um arquivo" />
                <EnviarImagem aoEnviar={(url) => setContato((c) => ({ ...c, logoUrl: url }))} rotulo="Enviar logo" />
              </div>
            </Campo>
            <Campo label="Barra de avisos" ajuda="Uma linha acima do cabeçalho, em toda a loja. Deixe vazio para não mostrar."><input className={inputClasse} value={contato.avisoTopo} onChange={(e) => setContato({ ...contato, avisoTopo: e.target.value })} placeholder="Frete grátis acima de R$ 199 · entrega em todo o Brasil" /></Campo>
            <Campo label="WhatsApp"><input className={inputClasse} value={contato.whatsapp} onChange={(e) => setContato({ ...contato, whatsapp: e.target.value })} /></Campo>
            <Campo label="E-mail de contato"><input className={inputClasse} value={contato.emailContato} onChange={(e) => setContato({ ...contato, emailContato: e.target.value })} /></Campo>
            <Campo label="Domínio próprio" ajuda="Depois de salvar, clique em “Configurar DNS e e-mail”."><input className={inputClasse} value={contato.dominioPrincipal} onChange={(e) => setContato({ ...contato, dominioPrincipal: e.target.value })} placeholder="sualoja.com.br" /></Campo>
          </div>
          <Campo label="Colar identidade (JSON)" ajuda="Para quem monta a identidade fora daqui (designer, ChatGPT): cole o JSON do docs/IDENTIDADE-VISUAL.md. Só as chaves presentes mudam.">
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea className={`${inputClasse} h-24 py-2 font-mono text-xs`} value={jsonIdentidade} onChange={(e) => setJsonIdentidade(e.target.value)} placeholder='{"tema":{"corPrimaria":"#c62828","layout":"editorial"},"slogan":"…"}' />
              <button className="btn-secundario" disabled={ocupado || !jsonIdentidade.trim()} onClick={() => {
                let corpo: unknown;
                try { corpo = JSON.parse(jsonIdentidade); } catch { setErro("JSON inválido."); return; }
                chamar("/api/painel/loja", "PATCH", corpo, "Identidade aplicada.").then((d) => { if (d) setJsonIdentidade(""); });
              }}>Aplicar</button>
            </div>
          </Campo>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", { tema, identidade, segmento, ...Object.fromEntries(Object.entries(contato).filter(([, v]) => v !== "")), avisoTopo: contato.avisoTopo.trim() || null, bannerUrl: contato.bannerUrl || null }, "Marca publicada.")}>Publicar identidade</button>
            <button className="btn-secundario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "POST", undefined, "Configuração reexecutada.")}>Configurar DNS e e-mail</button>
          </div>
          {Object.keys(loja.provisionamento).length > 0 && (
            <ul className="text-xs text-muted-foreground">{Object.entries(loja.provisionamento).map(([k, v]) => <li key={k}><strong className="uppercase">{k}</strong>: {v}</li>)}</ul>
          )}
        </Secao>
      )}

      {aba === "Entrega" && (
        <Secao titulo="Entrega e frete" descricao="Sem tabela, o cliente vê apenas retirada na loja (ou frete a combinar).">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={entrega.retiradaNaLoja} onChange={(e) => setEntrega({ ...entrega, retiradaNaLoja: e.target.checked })} /> Retirada na loja</label>
            <Campo label="Despacho (dias úteis)"><input className={inputClasse} type="number" min={0} max={30} value={entrega.despachoDiasUteis} onChange={(e) => setEntrega({ ...entrega, despachoDiasUteis: Number(e.target.value) })} /></Campo>
            <Campo label="Frete grátis acima de (R$)"><input className={inputClasse} value={entrega.freteGratisAcima} onChange={(e) => setEntrega({ ...entrega, freteGratisAcima: e.target.value })} placeholder="200,00" /></Campo>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tabela por estado (UF separadas por vírgula; * = resto do Brasil)</p>
          {entrega.tabela.map((f, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <input className={inputClasse} placeholder="SP,MG" value={f.ufs} onChange={(e) => setEntrega({ ...entrega, tabela: entrega.tabela.map((x, j) => (j === i ? { ...x, ufs: e.target.value.toUpperCase() } : x)) })} />
              <input className={inputClasse} placeholder="Preço R$" value={f.preco} onChange={(e) => setEntrega({ ...entrega, tabela: entrega.tabela.map((x, j) => (j === i ? { ...x, preco: e.target.value } : x)) })} />
              <input className={inputClasse} placeholder="Prazo (dias)" value={f.prazo} onChange={(e) => setEntrega({ ...entrega, tabela: entrega.tabela.map((x, j) => (j === i ? { ...x, prazo: e.target.value } : x)) })} />
              <input className={inputClasse} placeholder="Nome (Sedex…)" value={f.nome} onChange={(e) => setEntrega({ ...entrega, tabela: entrega.tabela.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} />
              <button className="btn-secundario" onClick={() => setEntrega({ ...entrega, tabela: entrega.tabela.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn-secundario" onClick={() => setEntrega({ ...entrega, tabela: [...entrega.tabela, { ufs: "*", preco: "", prazo: "7", nome: "Entrega" }] })}>+ faixa</button>
            <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", {
              retiradaNaLoja: entrega.retiradaNaLoja, despachoDiasUteis: entrega.despachoDiasUteis,
              freteGratisAcima: entrega.freteGratisAcima ? centavos(entrega.freteGratisAcima) : null,
              tabelaFrete: entrega.tabela.filter((f) => f.ufs && f.preco).map((f) => ({ ufs: f.ufs.split(",").map((u) => u.trim()).filter(Boolean), preco: centavos(f.preco), prazoDiasUteis: Number(f.prazo) || 7, nome: f.nome || undefined })),
            })}>Salvar</button>
          </div>
        </Secao>
      )}

      {aba === "Recebimento" && (
        <Secao titulo="Recebimento (Mercado Pago)" descricao="O dinheiro cai direto na sua conta. Crie as credenciais em Mercado Pago → Suas integrações → Credenciais de produção.">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {loja.mpConfigurado ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Recebendo</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Ainda não recebe</span>
            )}
            {!loja.mpConfigurado && <span className="text-muted-foreground">Sem isto, o cliente monta o carrinho e não consegue pagar.</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Public key"><input className={inputClasse} value={mp.publicKey} onChange={(e) => setMp({ ...mp, publicKey: e.target.value })} placeholder="APP_USR-…" /></Campo>
            <Campo label="Access token" ajuda={loja.mpPublicKey ? "Já configurado. Preencha só para trocar." : undefined}><input className={inputClasse} type="password" value={mp.accessToken} onChange={(e) => setMp({ ...mp, accessToken: e.target.value })} placeholder="APP_USR-…" /></Campo>
            <Campo label="Segredo do webhook" ajuda="Cadastre a URL abaixo no painel do Mercado Pago e cole aqui o segredo que ele gerar."><input className={inputClasse} type="password" value={mp.webhookSecret} onChange={(e) => setMp({ ...mp, webhookSecret: e.target.value })} /></Campo>
          </div>

          <Campo label="URL para cadastrar no Mercado Pago" ajuda="Suas integrações → sua aplicação → Webhooks. Eventos: pagamentos.">
            <div className="flex gap-2">
              <input className={inputClasse} readOnly value={`${loja.url}/api/webhooks/mercadopago?loja=${loja.slug}`} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn-secundario shrink-0" onClick={() => navigator.clipboard?.writeText(`${loja.url}/api/webhooks/mercadopago?loja=${loja.slug}`).then(() => setOk("Endereço copiado."), () => setErro("Copie à mão: o navegador bloqueou."))}>Copiar</button>
            </div>
          </Campo>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" disabled={ocupado || !mp.publicKey || !mp.accessToken} onClick={() => chamar("/api/painel/loja", "PATCH", { mercadoPago: { publicKey: mp.publicKey, accessToken: mp.accessToken, webhookSecret: mp.webhookSecret || undefined } }, "Recebimento configurado.").then(() => { setMp({ ...mp, accessToken: "", webhookSecret: "" }); setDiagnostico(null); })}>Salvar credenciais</button>
            <button className="btn-secundario" disabled={ocupado} onClick={() => chamar("/api/painel/recebimento", "POST", { accessToken: mp.accessToken || undefined, publicKey: mp.publicKey || undefined }, "Teste concluído.").then((d) => d && setDiagnostico(d))}>
              Testar recebimento
            </button>
          </div>

          {diagnostico && (
            <div className={`rounded-xl border p-4 text-sm ${diagnostico.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <p className="font-semibold">{diagnostico.mensagem}</p>
              {diagnostico.conta?.apelido && (
                <p className="mt-1 text-muted-foreground">Conta: {diagnostico.conta.apelido}{diagnostico.conta.email ? ` (${diagnostico.conta.email})` : ""}</p>
              )}
              {diagnostico.avisos.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {diagnostico.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>
          )}
        </Secao>
      )}

      {aba === "Assinatura" && (
        <Secao titulo={`Plano ${loja.assinatura.planoNome} · ${brl(loja.assinatura.precoCentavos)}/mês`} descricao="Cobrança mensal no cartão, pelo Mercado Pago da Avila Ops. O setup de R$ 497 é combinado à parte, no fechamento.">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {loja.assinatura.isenta ? (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">Loja da casa: sem cobrança</span>
            ) : (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(ASSINATURA[loja.assinatura.status] ?? ASSINATURA.SEM_ASSINATURA).classe}`}>{(ASSINATURA[loja.assinatura.status] ?? ASSINATURA.SEM_ASSINATURA).rotulo}</span>
            )}
            {loja.assinatura.ultimoPagamentoEm && <span className="text-muted-foreground">último pagamento {new Date(loja.assinatura.ultimoPagamentoEm).toLocaleDateString("pt-BR")}</span>}
            <span className="text-muted-foreground">setup: {loja.assinatura.setupPagoEm ? "pago" : "a combinar"}</span>
          </div>
          {!loja.assinatura.isenta && loja.assinatura.status === "SEM_ASSINATURA" && (
            <p className="text-sm text-muted-foreground">
              Sua loja está no período de teste de 14 dias (desde {new Date(loja.assinatura.criadoEm).toLocaleDateString("pt-BR")}). Ative a cobrança para não interromper as vendas.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!loja.assinatura.isenta && loja.assinatura.status !== "AUTORIZADA" && (
              <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/assinatura", "POST", undefined, "Assinatura criada.").then((d) => { if (d?.initPoint) window.location.href = d.initPoint; })}>
                {loja.assinatura.status === "PENDENTE" ? "Cadastrar cartão" : "Ativar cobrança mensal"}
              </button>
            )}
            {["AUTORIZADA", "PENDENTE", "PAUSADA"].includes(loja.assinatura.status) && (
              <button className="btn-secundario" disabled={ocupado} onClick={() => confirm("Cancelar a assinatura? A loja sai do ar ao fim do período pago.") && chamar("/api/painel/assinatura", "DELETE", undefined, "Assinatura cancelada.")}>Cancelar assinatura</button>
            )}
          </div>
          {loja.assinatura.faturas.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Data</th><th>Valor</th><th>Situação</th></tr></thead>
              <tbody>
                {loja.assinatura.faturas.map((f) => (
                  <tr key={f.id} className="border-t border-border"><td className="py-2">{new Date(f.pagaEm ?? f.criadoEm).toLocaleDateString("pt-BR")}</td><td>{brl(f.centavos)}</td><td>{f.status === "approved" ? "Paga" : f.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Secao>
      )}

      {aba === "Conta" && (
        <>
        <Secao titulo="Dados da empresa" descricao="Quem vende pela internet é obrigado a exibir razão social, CNPJ e endereço (Decreto 7.962/2013). Preenchendo aqui, isso aparece sozinho no rodapé de todas as páginas e nas políticas da loja.">
          {(!loja.razaoSocial || !loja.cnpj) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Sua loja ainda não exibe a identificação da empresa. Sem ela, o cliente que reclamar no Procon tem razão de cara, e o Google Ads costuma reprovar o anúncio.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Razão social" ajuda="O nome que está no cartão CNPJ, não o nome fantasia."><input className={inputClasse} value={empresa.razaoSocial} onChange={(e) => setEmpresa({ ...empresa, razaoSocial: e.target.value })} placeholder="Vedashow Comércio de Vedações Ltda" /></Campo>
            <Campo label="CNPJ"><input className={inputClasse} value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} placeholder="00.000.000/0001-00" inputMode="numeric" /></Campo>
          </div>
          <div><button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", { razaoSocial: empresa.razaoSocial.trim() || null, cnpj: empresa.cnpj.trim() || null }, "Dados da empresa salvos.")}>Salvar</button></div>
        </Secao>
        <Secao titulo="Senha do painel">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Senha atual"><input className={inputClasse} type="password" value={senha.atual} onChange={(e) => setSenha({ ...senha, atual: e.target.value })} /></Campo>
            <Campo label="Nova senha" ajuda="Mínimo 8 caracteres"><input className={inputClasse} type="password" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} /></Campo>
          </div>
          <div><button className="btn-primario" disabled={ocupado || senha.nova.length < 8} onClick={() => chamar("/api/painel/senha", "POST", senha, "Senha alterada.").then(() => setSenha({ atual: "", nova: "" }))}>Trocar senha</button></div>
        </Secao>
        </>
      )}
    </div>
  );
}
