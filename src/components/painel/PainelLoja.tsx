"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LAYOUTS, type TemaLoja } from "@/lib/tema";
import { criarDirecaoVisual, PERSONALIDADES, SEGMENTOS, type IdentidadeLoja } from "@/lib/identidade";
import { Campo, FONTES, Secao, brl, inputClasse, lerCsvProdutos } from "./campos";
import EnviarImagem from "./EnviarImagem";
import GradeVariantes from "./GradeVariantes";
import Cupons, { type CupomView } from "./Cupons";
import EditarProduto from "./EditarProduto";
import Categorias, { type CategoriaView } from "./Categorias";
import AvaliacoesPainel, { type AvaliacaoPainelView } from "./AvaliacoesPainel";
import Buscadores from "./Buscadores";
import Vendas from "./Vendas";
import type { ResumoVendas } from "@/lib/relatorio";
import type { DiagnosticoFeed } from "@/lib/catalogo";
import Anuncios, { type PixelsView } from "./Anuncios";

export interface LojaView {
  slug: string;
  nome: string;
  url: string;
  status: string;
  plano: string;
  tema: TemaLoja;
  identidade: IdentidadeLoja;
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
  tabelaFrete: Array<{ ufs: string[]; preco: number; prazoDiasUteis: number; nome?: string }>;
  assinatura: { status: string; precoCentavos: number; planoNome: string; ultimoPagamentoEm: string | null; setupPagoEm: string | null; criadoEm: string; faturas: Array<{ id: string; centavos: number; status: string; pagaEm: string | null; criadoEm: string }> };
}
export interface ProdutoView { id: string; nome: string; sku: string | null; precoCentavos: number; ativo: boolean; destaque: boolean; categoria: string | null; imagem: string | null; disponibilidade: string; estoque: number | null; opcoes: string[]; variantes: number }
export interface PedidoView { id: string; numero: number; referencia: string; status: string; clienteNome: string; clienteTelefone: string; totalCentavos: number; meioPagamento: string; freteNome: string; rastreio: string | null; criadoEm: string; itens: Array<{ nome: string; quantidade: number }> }

const STATUS: Record<string, string> = { ATIVA: "No ar", PROVISIONANDO: "Configurando", SUSPENSA: "Suspensa", CANCELADA: "Cancelada" };
const PEDIDO: Record<string, string> = { AGUARDANDO_PAGAMENTO: "Aguardando pagamento", PAGO: "Pago — separar", EM_SEPARACAO: "Em separação", ENVIADO: "Enviado", ENTREGUE: "Entregue", CANCELADO: "Cancelado", ESTORNADO: "Estornado" };
const ABAS = ["Visão geral", "Marca", "Produtos", "Pedidos", "Cupons", "Avaliações", "Buscadores", "Anúncios", "Entrega", "Recebimento", "Assinatura", "Conta"] as const;
const ASSINATURA: Record<string, { rotulo: string; classe: string }> = {
  SEM_ASSINATURA: { rotulo: "Período de teste", classe: "bg-amber-100 text-amber-800" },
  PENDENTE: { rotulo: "Aguardando cartão", classe: "bg-amber-100 text-amber-800" },
  AUTORIZADA: { rotulo: "Ativa", classe: "bg-emerald-100 text-emerald-800" },
  PAUSADA: { rotulo: "Pausada", classe: "bg-red-100 text-red-800" },
  CANCELADA: { rotulo: "Cancelada", classe: "bg-red-100 text-red-800" },
};

export default function PainelLoja({ loja, produtos, pedidos, cupons, categorias, avaliacoes, vendas, catalogo, espera }: { loja: LojaView; produtos: ProdutoView[]; pedidos: PedidoView[]; cupons: CupomView[]; categorias: CategoriaView[]; avaliacoes: AvaliacaoPainelView[]; vendas: ResumoVendas; catalogo: DiagnosticoFeed; espera: Array<{ produto: string; pessoas: number }> }) {
  const [gradeDe, setGradeDe] = useState<ProdutoView | null>(null);
  const [editando, setEditando] = useState<ProdutoView | null>(null);
  const router = useRouter();
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Visão geral");
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
  const [rastreio, setRastreio] = useState<Record<string, string>>({});
  const [tema, setTema] = useState({ corPrimaria: loja.tema.corPrimaria, modo: loja.tema.modo, fonte: loja.tema.fonte, raio: loja.tema.raio, layout: loja.tema.layout });
  const [identidade, setIdentidade] = useState(loja.identidade);
  const [empresa, setEmpresa] = useState({ razaoSocial: loja.razaoSocial ?? "", cnpj: loja.cnpj ?? "" });
  const [contato, setContato] = useState({ avisoTopo: loja.avisoTopo ?? "", slogan: loja.slogan ?? "", whatsapp: loja.whatsapp ?? "", emailContato: loja.emailContato ?? "", logoUrl: loja.logoUrl ?? "", bannerUrl: loja.bannerUrl ?? "", dominioPrincipal: loja.dominioPrincipal ?? "" });
  const [entrega, setEntrega] = useState({ retiradaNaLoja: loja.retiradaNaLoja, despachoDiasUteis: loja.despachoDiasUteis, freteGratisAcima: loja.freteGratisAcima != null ? String(loja.freteGratisAcima / 100).replace(".", ",") : "", tabela: loja.tabelaFrete.map((f) => ({ ufs: f.ufs.join(","), preco: String(f.preco / 100).replace(".", ","), prazo: String(f.prazoDiasUteis), nome: f.nome ?? "" })) });
  const [mp, setMp] = useState({ publicKey: loja.mpPublicKey ?? "", accessToken: "", webhookSecret: "" });
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
    setTema({ corPrimaria: nova.tema.corPrimaria, modo: nova.tema.modo, fonte: nova.tema.fonte, raio: nova.tema.raio, layout: nova.tema.layout });
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

  function avancar(p: PedidoView) {
    if (p.status === "PAGO") return chamar("/api/painel/pedidos", "PATCH", { id: p.id, status: "EM_SEPARACAO" }, "Pedido em separação.");
    if (p.status === "EM_SEPARACAO") return chamar("/api/painel/pedidos", "PATCH", { id: p.id, status: "ENVIADO", rastreio: rastreio[p.id] || null }, "Pedido enviado.");
    if (p.status === "ENVIADO") return chamar("/api/painel/pedidos", "PATCH", { id: p.id, status: "ENTREGUE" }, "Pedido entregue.");
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${loja.status === "ATIVA" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{STATUS[loja.status] ?? loja.status}</span>
        <span className="text-muted-foreground">Plano {loja.plano.replace("_", " ")}</span>
        {loja.emailRemetente && <span className="text-muted-foreground">e-mail: {loja.emailRemetente}</span>}
        <a href={loja.url} target="_blank" rel="noopener" className="ml-auto underline">Abrir loja</a>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border text-sm">
        {ABAS.map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`-mb-px border-b-2 px-3 py-2 ${aba === a ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>{a}</button>
        ))}
      </nav>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}

      {aba === "Visão geral" && (
        <div className="painel-overview">
          <Vendas r={vendas} espera={espera} irPara={setAba} />
          <section className="painel-hero">
            <div><span>Estúdio da sua loja</span><h2>Sua marca está {loja.status === "ATIVA" ? "no ar" : "em preparação"}.</h2><p>Cuide primeiro do que o cliente percebe: identidade clara, catálogo visual e uma experiência consistente.</p></div>
            <a href={loja.url} target="_blank" rel="noopener" className="btn-primario">Ver loja publicada ↗</a>
          </section>
          <div className="painel-metricas">
            <button onClick={() => setAba("Marca")}><small>Identidade</small><strong>{identidade.personalidade[0] || "A definir"}</strong><span>Refinar direção →</span></button>
            <button onClick={() => setAba("Produtos")}><small>Catálogo</small><strong>{produtos.length}</strong><span>{produtos.length ? "Gerenciar produtos →" : "Adicionar primeiro produto →"}</span></button>
            <button onClick={() => setAba("Pedidos")}><small>Operação</small><strong>{pedidos.length}</strong><span>Ver pedidos →</span></button>
          </div>
          <section className="painel-next">
            <div><small>Próximo passo recomendado</small><h3>{!loja.logoUrl ? "Envie o símbolo da sua marca" : !loja.bannerUrl ? "Crie a imagem principal da vitrine" : produtos.some((p) => !p.imagem) ? "Complete as fotos do catálogo" : "Sua presença visual está consistente"}</h3></div>
            <button className="btn-secundario" onClick={() => setAba(!loja.logoUrl || !loja.bannerUrl ? "Marca" : "Produtos")}>Resolver agora</button>
          </section>
        </div>
      )}

      {aba === "Produtos" && (
        <>
          {editando && <EditarProduto produtoId={editando.id} aoFechar={() => setEditando(null)} aoSalvar={(m) => { setOk(m); setEditando(null); router.refresh(); }} />}
          {gradeDe && <GradeVariantes produtoId={gradeDe.id} produtoNome={gradeDe.nome} aoFechar={() => setGradeDe(null)} aoSalvar={(m) => { setOk(m); setGradeDe(null); router.refresh(); }} />}
          <Secao titulo="Novo produto" descricao="Cadastro rápido. Foto: cole o link da imagem (ou use a planilha).">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome"><input className={inputClasse} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo>
              <Campo label="Categoria"><input className={inputClasse} value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} placeholder="Ex.: Vedações" /></Campo>
              <Campo label="Preço (R$)"><input className={inputClasse} value={novo.preco} onChange={(e) => setNovo({ ...novo, preco: e.target.value })} placeholder="59,90" inputMode="decimal" /></Campo>
              <Campo label="Preço “de” (R$)" ajuda="Opcional, para mostrar desconto"><input className={inputClasse} value={novo.precoDe} onChange={(e) => setNovo({ ...novo, precoDe: e.target.value })} inputMode="decimal" /></Campo>
              <Campo label="SKU / código"><input className={inputClasse} value={novo.sku} onChange={(e) => setNovo({ ...novo, sku: e.target.value })} /></Campo>
              <Campo label="Peso (kg)" ajuda="Para o frete"><input className={inputClasse} value={novo.pesoKg} onChange={(e) => setNovo({ ...novo, pesoKg: e.target.value })} inputMode="decimal" /></Campo>
              <Campo label="Estoque" ajuda="Vazio = não controla. Com variações, o estoque é por variação."><input className={inputClasse} value={novo.estoque} onChange={(e) => setNovo({ ...novo, estoque: e.target.value })} inputMode="numeric" /></Campo>
              <Campo label="Foto">
                <div className="flex items-center gap-2">
                  <input className={inputClasse} value={novo.imagem} onChange={(e) => setNovo({ ...novo, imagem: e.target.value })} placeholder="https://…/foto.jpg ou envie um arquivo" />
                  <EnviarImagem aoEnviar={(url) => setNovo((n) => ({ ...n, imagem: url }))} rotulo="Enviar foto" />
                </div>
              </Campo>
              <Campo label="Descrição curta"><input className={inputClasse} value={novo.descricaoCurta} onChange={(e) => setNovo({ ...novo, descricaoCurta: e.target.value })} /></Campo>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={novo.destaque} onChange={(e) => setNovo({ ...novo, destaque: e.target.checked })} /> Destaque na página inicial</label>
            <div><button className="btn-primario" disabled={ocupado} onClick={salvarProduto}>Salvar produto</button></div>
          </Secao>

          <Secao titulo="Importar planilha" descricao="Produto com o mesmo SKU é atualizado, não duplicado.">
            <p className="text-xs text-muted-foreground">Colunas: <code>nome, preco, categoria, marca, sku, preco_de, descricao_curta, descricao, imagem, destaque, peso_kg</code></p>
            <input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => e.target.files?.[0]?.text().then((t) => setCsv({ nome: e.target.files![0].name, ...lerCsvProdutos(t) }))} />
            {csv && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p><strong>{csv.nome}</strong>: {csv.produtos.length} produto(s).</p>
                {csv.erros.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">{csv.erros.slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>}
                <button className="btn-primario mt-3" disabled={ocupado || !csv.produtos.length} onClick={() => chamar("/api/painel/produtos", "PUT", csv.produtos, "Produtos importados.").then(() => setCsv(null))}>Importar</button>
              </div>
            )}
          </Secao>

          <Categorias categorias={categorias} chamar={chamar} ocupado={ocupado} />

          <Secao titulo={`Catálogo (${produtos.length})`} descricao="Clique no nome para editar (fotos, descrição, estoque, preço).">
            {produtos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum produto ainda.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Produto</th><th>Categoria</th><th>SKU</th><th>Preço</th><th>Estoque</th><th></th></tr></thead>
                  <tbody>
                    {produtos.map((p) => (
                      <tr key={p.id} className={`border-t border-border ${p.ativo ? "" : "opacity-50"}`}>
                        <td className="py-2"><button className="text-left hover:underline" onClick={() => { setEditando(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{p.destaque && "★ "}{p.nome}{!p.ativo && " (inativo)"}</button></td>
                        <td>{p.categoria ?? "—"}</td><td>{p.sku ?? "—"}</td><td>{brl(p.precoCentavos)}</td>
                        <td>{p.opcoes.length ? `${p.variantes} variações` : p.estoque == null ? "∞" : p.estoque === 0 ? <span className="text-red-700">esgotado</span> : p.estoque}</td>
                        <td className="whitespace-nowrap text-right text-xs">
                          {p.ativo && <button className="mr-2 underline" onClick={() => setGradeDe(p)}>{p.opcoes.length ? "grade" : "variações"}</button>}
                          {p.ativo && <button className="text-muted-foreground underline" disabled={ocupado} onClick={() => chamar(`/api/painel/produtos?id=${p.id}`, "DELETE", undefined, "Produto desativado.")}>desativar</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>
        </>
      )}

      {aba === "Cupons" && <Cupons cupons={cupons} chamar={chamar} ocupado={ocupado} />}

      {aba === "Avaliações" && <AvaliacoesPainel avaliacoes={avaliacoes} chamar={chamar} ocupado={ocupado} />}

      {aba === "Buscadores" && <Buscadores chamar={chamar} ocupado={ocupado} />}

      {aba === "Anúncios" && <Anuncios pixels={loja.pixels} catalogo={catalogo} feedUrl={`${loja.url}/feed/merchant.xml`} chamar={chamar} ocupado={ocupado} />}

      {aba === "Pedidos" && (
        <Secao titulo="Pedidos">
          {pedidos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">#</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Situação</th><th>Data</th><th></th></tr></thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id} className="border-t border-border align-top">
                      <td className="py-2">{p.numero}</td>
                      <td>{p.clienteNome}<br /><a className="text-xs underline" href={`https://wa.me/${p.clienteTelefone.replace(/\D/g, "")}`} target="_blank" rel="noopener">{p.clienteTelefone}</a></td>
                      <td className="text-xs">{p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}<br /><span className="text-muted-foreground">{p.freteNome}</span></td>
                      <td>{brl(p.totalCentavos)}</td>
                      <td>{PEDIDO[p.status] ?? p.status}{p.rastreio && <><br /><span className="text-xs">rastreio {p.rastreio}</span></>}</td>
                      <td className="text-xs">{new Date(p.criadoEm).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2">
                        {p.status === "EM_SEPARACAO" && <input className={`${inputClasse} mb-1 h-9`} placeholder="Código de rastreio" value={rastreio[p.id] ?? ""} onChange={(e) => setRastreio({ ...rastreio, [p.id]: e.target.value })} />}
                        {["PAGO", "EM_SEPARACAO", "ENVIADO"].includes(p.status) && (
                          <button className="btn-secundario h-9 px-3 text-xs" disabled={ocupado} onClick={() => avancar(p)}>
                            {p.status === "PAGO" ? "Separar" : p.status === "EM_SEPARACAO" ? "Marcar enviado" : "Marcar entregue"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Secao>
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
          </div>
          <Campo label="Layout da página inicial" ajuda="Quatro composições prontas dos mesmos blocos. Troque e veja na loja na hora.">
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
            <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", { tema, identidade, ...Object.fromEntries(Object.entries(contato).filter(([, v]) => v !== "")), avisoTopo: contato.avisoTopo.trim() || null, bannerUrl: contato.bannerUrl || null }, "Marca publicada.")}>Publicar identidade</button>
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
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={entrega.retiradaNaLoja} onChange={(e) => setEntrega({ ...entrega, retiradaNaLoja: e.target.checked })} /> Retirada na loja</label>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Public key"><input className={inputClasse} value={mp.publicKey} onChange={(e) => setMp({ ...mp, publicKey: e.target.value })} placeholder="APP_USR-…" /></Campo>
            <Campo label="Access token" ajuda={loja.mpPublicKey ? "Já configurado. Preencha só para trocar." : undefined}><input className={inputClasse} type="password" value={mp.accessToken} onChange={(e) => setMp({ ...mp, accessToken: e.target.value })} placeholder="APP_USR-…" /></Campo>
            <Campo label="Segredo do webhook" ajuda={`Cadastre no painel MP a URL: ${loja.url}/api/webhooks/mercadopago?loja=${loja.slug}`}><input className={inputClasse} type="password" value={mp.webhookSecret} onChange={(e) => setMp({ ...mp, webhookSecret: e.target.value })} /></Campo>
          </div>
          <div><button className="btn-primario" disabled={ocupado || !mp.publicKey || !mp.accessToken} onClick={() => chamar("/api/painel/loja", "PATCH", { mercadoPago: { publicKey: mp.publicKey, accessToken: mp.accessToken, webhookSecret: mp.webhookSecret || undefined } }, "Recebimento configurado.").then(() => setMp({ ...mp, accessToken: "", webhookSecret: "" }))}>Salvar credenciais</button></div>
        </Secao>
      )}

      {aba === "Assinatura" && (
        <Secao titulo={`Plano ${loja.assinatura.planoNome} — ${brl(loja.assinatura.precoCentavos)}/mês`} descricao="Cobrança mensal no cartão, pelo Mercado Pago da Avila Ops. O setup de R$ 497 é combinado à parte, no fechamento.">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(ASSINATURA[loja.assinatura.status] ?? ASSINATURA.SEM_ASSINATURA).classe}`}>{(ASSINATURA[loja.assinatura.status] ?? ASSINATURA.SEM_ASSINATURA).rotulo}</span>
            {loja.assinatura.ultimoPagamentoEm && <span className="text-muted-foreground">último pagamento {new Date(loja.assinatura.ultimoPagamentoEm).toLocaleDateString("pt-BR")}</span>}
            <span className="text-muted-foreground">setup: {loja.assinatura.setupPagoEm ? "pago" : "a combinar"}</span>
          </div>
          {loja.assinatura.status === "SEM_ASSINATURA" && (
            <p className="text-sm text-muted-foreground">
              Sua loja está no período de teste de 14 dias (desde {new Date(loja.assinatura.criadoEm).toLocaleDateString("pt-BR")}). Ative a cobrança para não interromper as vendas.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {loja.assinatura.status !== "AUTORIZADA" && (
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
              Sua loja ainda não exibe a identificação da empresa. Sem ela, o cliente que reclamar no Procon tem razão de cara — e o Google Ads costuma reprovar o anúncio.
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
