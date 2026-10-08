"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IdentidadeLoja } from "@/lib/identidade";
import type { TemaLoja } from "@/lib/tema";
import { Campo, Secao, brl, inputClasse } from "./campos";
import { PLANOS, mensalidade } from "@/lib/planos";
import Marca from "./Marca";
import Cupons, { type CupomView } from "./Cupons";
import Categorias, { type CategoriaView } from "./Categorias";
import AvaliacoesPainel, { type AvaliacaoPainelView } from "./AvaliacoesPainel";
import Buscadores from "./Buscadores";
import Vendas from "./Vendas";
import type { ResumoVendas } from "@/lib/relatorio";
import type { DiagnosticoFeed } from "@/lib/catalogo";
import Anuncios, { type PixelsView } from "./Anuncios";
import McpPainel from "./McpPainel";
import ChavesApiPainel from "./ChavesApiPainel";
import WebhooksPainel from "./WebhooksPainel";
import CatalogoLista from "./CatalogoLista";
import SoltarPlanilha from "./SoltarPlanilha";
import { FileCheck2 } from "lucide-react";
import Inventario from "./Inventario";
import Pedidos from "./Pedidos";
import NovoProduto from "./NovoProduto";
import ChecklistOnboarding from "./ChecklistOnboarding";
import { checklistDeOnboarding, resumoDoChecklist } from "@/lib/checklist-onboarding";

export interface LojaView {
  slug: string;
  nome: string;
  url: string;
  status: string;
  plano: string;
  tema: TemaLoja;
  identidade: IdentidadeLoja;
  segmento: string;
  /** Responsável técnico da farmácia (RDC 44/2009). Só usado no ramo farmácia. */
  farmaceuticoResponsavel: string | null;
  farmaceuticoCrf: string | null;
  licencaSanitaria: string | null;
  autorizacaoAnvisa: string | null;
  slogan: string | null;
  logoUrl: string | null;
  whatsapp: string | null;
  emailContato: string | null;
  avisoTopo: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
  endereco: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; cep?: string } | null;
  enderecoPublico: boolean;
  cepOrigem: string | null;
  dominioPrincipal: string | null;
  bannerUrl: string | null;
  mpPublicKey: string | null;
  emailRemetente: string | null;
  provisionamento: Record<string, string>;
  pixels: PixelsView;
  freteGratisAcima: number | null;
  pedidoMinimoCentavos: number | null;
  retiradaNaLoja: boolean;
  despachoDiasUteis: number;
  estoqueBaixoEm: number;
  tabelaFrete: Array<{ ufs: string[]; preco: number; prazoDiasUteis: number; nome?: string }>;
  entregaLocal: Array<{ prefixos: string[]; nome: string; preco: number; prazoDiasUteis: number; gratisAcima?: number | null }>;
  /** Já tem credencial salva: o checkout aparece na loja. */
  mpConfigurado: boolean;
  /** A credencial veio da conexão por OAuth, e não de chave colada. */
  mpPorOAuth: boolean;
  /** O aplicativo da plataforma existe: o botão de conectar aparece acima deste formulário. */
  mpOAuthDisponivel: boolean;
  assinatura: { status: string; plano: string; podeTrocarPlano: boolean; isenta: boolean; precoCentavos: number; planoNome: string; ultimoPagamentoEm: string | null; setupPagoEm: string | null; criadoEm: string; testeAte: string; emTeste: boolean; faturas: Array<{ id: string; centavos: number; status: string; pagaEm: string | null; criadoEm: string }> };
}
export interface EnderecoEntregaView { logradouro: string; numero: string; complemento?: string | null; bairro: string; cidade: string; uf: string; cep: string }
export interface PedidoView { id: string; numero: number; referencia: string; status: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; clienteDocumento: string; totalCentavos: number; subtotalCentavos: number; freteCentavos: number; descontoCentavos: number; cupomCodigo: string | null; meioPagamento: string; freteNome: string; rastreio: string | null; entrega: EnderecoEntregaView | null; etiqueta: { status: string; codigoObjeto: string | null; pdf: string | null; custoCentavos: number } | null; criadoEm: string; itens: Array<{ nome: string; quantidade: number; sku: string | null; precoUnitarioCentavos: number }> }

const STATUS: Record<string, string> = { ATIVA: "No ar", PROVISIONANDO: "Configurando", SUSPENSA: "Suspensa", CANCELADA: "Cancelada" };
const CAMPOS_IMPORTACAO = [
  ["nome", "nome"], ["precoCentavos", "preço"], ["precoDeCentavos", "preço de"], ["categoria", "categoria"],
  ["googleProductCategory", "categoria Google"], ["marca", "marca"], ["sku", "SKU"], ["gtin", "GTIN"],
  ["mpn", "MPN"], ["identificadoresEstado", "estado dos identificadores"], ["descricaoCurta", "descrição curta"],
  ["descricao", "descrição"], ["imagens", "foto"], ["imagemOrigem", "origem da foto"], ["imagemFamilia", "família da foto"],
  ["confirmarImagemExata", "confirmação da foto exata"], ["destaque", "destaque"], ["estoque", "estoque"],
  ["pesoKg", "peso"], ["alturaCm", "altura"], ["larguraCm", "largura"], ["comprimentoCm", "comprimento"], ["ativo", "status"],
] as const;

function camposDaImportacao(produto: Record<string, unknown>) {
  return CAMPOS_IMPORTACAO.filter(([chave]) => produto[chave] !== undefined).map(([, rotulo]) => rotulo);
}

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
  "IA": "/painel/ia",
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function chamar(caminho: string, method: string, body?: unknown, sucesso = "Salvo.") {
    setErro(null); setOk(null); setAviso(null); setOcupado(true);
    try {
      const r = await fetch(caminho, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? "Falha.");
      setOk(sucesso);
      if (Array.isArray(d?.avisos) && d.avisos.length) {
        const total = Number(d.avisosTotal) || d.avisos.length;
        setAviso(`${total} linha(s) precisam de atenção: ${d.avisos.slice(0, 5).join(" · ")}${total > 5 ? " · e outras" : ""}`);
      }
      router.refresh(); return d;
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha inesperada."); } finally { setOcupado(false); }
  }

  // ── estado dos formulários ──
  const [novo, setNovo] = useState({ nome: "", preco: "", precoDe: "", categoria: "", sku: "", descricaoCurta: "", imagem: "", destaque: false, pesoKg: "", estoque: "" });
  const [csv, setCsv] = useState<{ nome: string; produtos: Array<Record<string, unknown>>; erros: string[] } | null>(null);
  /** Quantos produtos já foram gravados, enquanto os lotes sobem. */
  const [importando, setImportando] = useState<{ feitos: number; total: number } | null>(null);
  const [limiteEstoque, setLimiteEstoque] = useState(String(loja.estoqueBaixoEm));
  const [empresa, setEmpresa] = useState({ razaoSocial: loja.razaoSocial ?? "", cnpj: loja.cnpj ?? "" });
  const [enderecoEmpresa, setEnderecoEmpresa] = useState({
    logradouro: loja.endereco?.logradouro ?? "", numero: loja.endereco?.numero ?? "",
    complemento: loja.endereco?.complemento ?? "", bairro: loja.endereco?.bairro ?? "",
    cidade: loja.endereco?.cidade ?? "", uf: loja.endereco?.uf ?? "",
    cep: loja.endereco?.cep ?? loja.cepOrigem ?? "", enderecoPublico: loja.enderecoPublico,
  });
  const [entrega, setEntrega] = useState({ retiradaNaLoja: loja.retiradaNaLoja, despachoDiasUteis: loja.despachoDiasUteis, freteGratisAcima: loja.freteGratisAcima != null ? String(loja.freteGratisAcima / 100).replace(".", ",") : "", pedidoMinimo: loja.pedidoMinimoCentavos != null ? String(loja.pedidoMinimoCentavos / 100).replace(".", ",") : "", tabela: loja.tabelaFrete.map((f) => ({ ufs: f.ufs.join(","), preco: String(f.preco / 100).replace(".", ","), prazo: String(f.prazoDiasUteis), nome: f.nome ?? "" })), local: loja.entregaLocal.map((f) => ({ prefixos: f.prefixos.join(","), nome: f.nome, preco: String(f.preco / 100).replace(".", ","), prazo: String(f.prazoDiasUteis), gratis: f.gratisAcima != null ? String(f.gratisAcima / 100).replace(".", ",") : "" })) });
  // Conectada por OAuth, a public key salva é a da conexão: pré-preencher o
  // formulário das chaves com ela convidaria a salvar um par que não combina.
  const [mp, setMp] = useState({ publicKey: loja.mpPorOAuth ? "" : loja.mpPublicKey ?? "", accessToken: "", webhookSecret: "" });
  // Diagnóstico do recebimento: credencial errada só dava erro na primeira
  // venda, com o comprador esperando. Aqui o lojista confere antes.
  const [diagnostico, setDiagnostico] = useState<{ ok: boolean; mensagem: string; conta?: { apelido: string | null; email: string | null }; avisos: string[] } | null>(null);
  const [senha, setSenha] = useState({ atual: "", nova: "" });

  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);

  /**
   * A planilha é lida no servidor, não no navegador: é lá que existe o
   * descompactador que abre .xlsx, e é assim que os dois formatos passam
   * pelas mesmas regras de coluna.
   */
  async function lerPlanilha(arquivo: File) {
    setErro(null); setOk(null); setOcupado(true);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const r = await fetch("/api/painel/produtos/planilha", { method: "POST", body: corpo });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível ler a planilha.");
      setCsv({ nome: arquivo.name, produtos: d.produtos ?? [], erros: d.erros ?? [] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Importa em lotes.
   *
   * A rota grava no máximo 2.000 por requisição, e uma distribuidora tem
   * 5.591 itens: mandar tudo de uma vez devolvia "Dados inválidos" justamente
   * para o catálogo que mais precisa de correção em lote. Em lotes menores a
   * tela ainda diz onde parou se a conexão cair no meio — o que já entrou
   * está gravado, e reenviar o mesmo arquivo atualiza em vez de duplicar,
   * porque o SKU é a chave.
   */
  const POR_LOTE = 500;

  async function importarPlanilha(produtos: Array<Record<string, unknown>>) {
    setErro(null); setOk(null); setAviso(null); setOcupado(true);
    setImportando({ feitos: 0, total: produtos.length });
    let criados = 0, atualizados = 0, totalAvisos = 0;
    const avisos: string[] = [];
    try {
      for (let i = 0; i < produtos.length; i += POR_LOTE) {
        const lote = produtos.slice(i, i + POR_LOTE);
        const r = await fetch("/api/painel/produtos", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(lote),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.erro ?? "Falha ao importar.");
        criados += d.criados ?? 0;
        atualizados += d.atualizados ?? 0;
        // Cada lote devolve só os 50 primeiros avisos; o total vem à parte.
        if (Array.isArray(d.avisos)) {
          avisos.push(...d.avisos);
          totalAvisos += Number(d.avisosTotal) || d.avisos.length;
        }
        setImportando({ feitos: Math.min(i + POR_LOTE, produtos.length), total: produtos.length });
      }
      setCsv(null);
      setOk(`${criados.toLocaleString("pt-BR")} produto(s) criados e ${atualizados.toLocaleString("pt-BR")} atualizados.`);
      if (totalAvisos) setAviso(`${totalAvisos} linha(s) precisam de atenção: ${avisos.slice(0, 5).join(" · ")}${totalAvisos > 5 ? " · e outras" : ""}`);
      router.refresh();
    } catch (e) {
      // O que já subiu ficou: dizer quanto entrou é o que permite continuar.
      setErro(`${e instanceof Error ? e.message : "Falha ao importar."} ${(criados + atualizados).toLocaleString("pt-BR")} produto(s) já foram gravados.`);
    } finally {
      setImportando(null);
      setOcupado(false);
    }
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
      {aviso && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{aviso}</p>}


      {aba === "Visão geral" && (
        <div className="painel-overview">
          <Vendas r={vendas} espera={espera} irPara={irPara} />

          {/* O painel responde o que precisa de acao, nao explica a plataforma.
              Havia aqui um bloco institucional ("Sua marca esta no ar. Cuide
              primeiro do que o cliente percebe...") maior que o resumo de
              vendas inteiro: quem ja entrou no painel nao precisa que lhe
              vendam o painel. */}
          {/* Enquanto falta passo obrigatorio para a loja vender, o checklist
              ocupa o lugar do "Proximo passo". O estado e derivado do que ja
              esta gravado (src/lib/checklist-onboarding.ts): nao ha coluna. */}
          {(() => {
            const passos = checklistDeOnboarding({
              status: loja.status,
              url: loja.url,
              logoUrl: loja.logoUrl,
              whatsapp: loja.whatsapp,
              dominioPrincipal: loja.dominioPrincipal,
              produtosAtivos: contagens.ativos,
              mpConfigurado: loja.mpConfigurado,
              cepOrigem: loja.cepOrigem,
              tabelaFrete: loja.tabelaFrete,
              entregaLocal: loja.entregaLocal,
              retiradaNaLoja: loja.retiradaNaLoja,
              enderecoPublico: loja.enderecoPublico,
              endereco: loja.endereco,
            });
            const resumo = resumoDoChecklist(passos);
            if (!resumo.completo) return <ChecklistOnboarding passos={passos} resumo={resumo} />;
            return (
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
            );
          })()}

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
            <p className="text-xs text-muted-foreground">Colunas: <code>nome, preco, categoria, google_product_category, marca, sku, gtin, mpn, identificadores_estado, preco_de, descricao_curta, descricao, imagem, imagem_origem, imagem_familia, confirmar_imagem_exata, correspondencia_imagem, destaque, peso_kg, altura_cm, largura_cm, comprimento_cm, estoque, ativo</code></p>
            <p className="text-xs text-muted-foreground">Use MPN somente para o código do fabricante. Em <code>google_product_category</code>, informe o ID ou o caminho oficial confirmado. Em atualização por planilha, a célula vazia mantém o valor salvo; escreva <code>auto</code> para remover uma substituição e voltar à classificação automática. Em <code>identificadores_estado</code>, informe <code>desconhecido</code>, <code>informado</code> ou <code>sem_identificador</code>, conforme embalagem ou fornecedor. Em <code>confirmar_imagem_exata</code>, informe <code>sim</code> só depois de conferir que a foto principal mostra exatamente o produto e a apresentação daquele SKU. Em <code>correspondencia_imagem</code>, use <code>confirmada</code> ou <code>rejeitada</code> após conferir a foto principal. A rejeição bloqueia o item do Merchant até substituir a foto e revisar o estado. Em produtos com variantes, a planilha atualiza a apresentação padrão.</p>
            {/* São as mesmas colunas que a exportação do Catálogo grava: o
                caminho de corrigir em lote é baixar, mexer e devolver. Coluna
                que não vier no arquivo não é mexida no produto. */}
            <p className="text-xs text-muted-foreground">
              Para atualizar um produto existente, informe o <code>sku</code> e somente as colunas que deseja corrigir. Para cadastrar um produto novo, informe <code>nome</code> e <code>preco</code>. Colunas ausentes e células vazias preservam o valor atual; para limpar a família da imagem, deixe a coluna <code>imagem_familia</code> presente e vazia. Aceita .csv e .xlsx: para corrigir em lote, baixe o catálogo na aba Catálogo, ajuste no Excel e reenvie o mesmo arquivo aqui.
            </p>
            <SoltarPlanilha desabilitado={ocupado} onArquivo={(a) => void lerPlanilha(a)} />
            {csv && (
              <div className="rounded-lg border border-border p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <FileCheck2 size={16} className="flex-none text-emerald-600" aria-hidden="true" />
                  <strong>{csv.nome}</strong>
                  <span className="text-muted-foreground">
                    {csv.produtos.length.toLocaleString("pt-BR")} produto(s) prontos para importar
                  </span>
                </p>
                {csv.produtos.length > 0 && <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border">
                  <ul aria-label="Prévia dos produtos e campos da importação" className="divide-y divide-border">
                    {csv.produtos.slice(0, 10).map((produto, indice) => <li key={`${String(produto.sku ?? produto.slug ?? produto.nome ?? "produto")}-${indice}`} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.2fr)] sm:items-start">
                      <span className="min-w-0 break-words font-medium">{produto.sku ? `SKU ${String(produto.sku)}` : "Novo produto"}{produto.nome ? ` · ${String(produto.nome)}` : ""}</span>
                      <span className="text-muted-foreground">Campos: {camposDaImportacao(produto).join(", ") || "nenhum"}</span>
                    </li>)}
                  </ul>
                  {csv.produtos.length > 10 && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Prévia das primeiras 10 linhas de {csv.produtos.length.toLocaleString("pt-BR")}.</p>}
                </div>}
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
                    onClick={() => void importarPlanilha(csv.produtos)}
                  >
                    {importando
                      ? `Importando ${importando.feitos.toLocaleString("pt-BR")} de ${importando.total.toLocaleString("pt-BR")}…`
                      : `Importar ${csv.produtos.length.toLocaleString("pt-BR")} produto(s)`}
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

      {aba === "IA" && (
        <>
          <McpPainel lojaPlano={loja.plano} lojaSlug={loja.slug} aoIrParaAssinatura={() => irPara("Assinatura")} />
          <ChavesApiPainel />
          <WebhooksPainel />
        </>
      )}

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

      {aba === "Marca" && <Marca loja={loja} categorias={categorias} chamar={chamar} ocupado={ocupado} />}

      {aba === "Entrega" && (
        <Secao titulo="Entrega e frete" descricao="Vale quando o Melhor Envio não está conectado ou não atende o destino. Sem ele e sem tabela, o cliente vê apenas retirada na loja (ou frete a combinar).">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={entrega.retiradaNaLoja} onChange={(e) => setEntrega({ ...entrega, retiradaNaLoja: e.target.checked })} /> Retirada na loja</label>
            <Campo label="Despacho (dias úteis)"><input className={inputClasse} type="number" min={0} max={30} value={entrega.despachoDiasUteis} onChange={(e) => setEntrega({ ...entrega, despachoDiasUteis: Number(e.target.value) })} /></Campo>
            <Campo label="Frete grátis acima de (R$)"><input className={inputClasse} value={entrega.freteGratisAcima} onChange={(e) => setEntrega({ ...entrega, freteGratisAcima: e.target.value })} placeholder="200,00" /></Campo>
            <Campo label="Pedido mínimo em produtos (R$)"><input className={inputClasse} inputMode="decimal" value={entrega.pedidoMinimo} onChange={(e) => setEntrega({ ...entrega, pedidoMinimo: e.target.value })} placeholder="Sem mínimo" /></Campo>
          </div>
          <p className="text-xs text-muted-foreground">Pedido mínimo: abaixo desse valor em produtos (sem frete, antes de cupom) o carrinho avisa quanto falta e a compra não é concluída. Deixe em branco para não ter mínimo. Se a loja anuncia no Google, repita o mesmo valor em &quot;valor mínimo do pedido&quot; no serviço de frete do Merchant Center.</p>
          {entrega.retiradaNaLoja && (!loja.enderecoPublico || !loja.endereco?.logradouro || !loja.endereco?.numero || !loja.endereco?.cidade || !loja.endereco?.uf || loja.endereco?.cep?.replace(/\D/g, "").length !== 8) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Para oferecer retirada, complete o endereço e marque a exibição pública na seção Conta. Salve o endereço e volte aqui para ativar.</p>
          )}
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
          <button className="btn-secundario self-start" onClick={() => setEntrega({ ...entrega, tabela: [...entrega.tabela, { ufs: "*", preco: "", prazo: "7", nome: "Entrega" }] })}>+ faixa</button>

          {/* Entrega da própria loja. Fica separada da tabela por UF porque não
              é transportadora: ela concorre com o PAC no mesmo checkout e é a
              única que continua de pé se a cotação online cair. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Você mesmo entrega (motoboy, frota) — primeiros dígitos do CEP, separados por vírgula</p>
          {entrega.local.map((f, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
              <input className={inputClasse} placeholder="14,15" value={f.prefixos} onChange={(e) => setEntrega({ ...entrega, local: entrega.local.map((x, j) => (j === i ? { ...x, prefixos: e.target.value } : x)) })} />
              <input className={inputClasse} placeholder="Nome (Motoboy…)" value={f.nome} onChange={(e) => setEntrega({ ...entrega, local: entrega.local.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} />
              <input className={inputClasse} placeholder="Preço R$" value={f.preco} onChange={(e) => setEntrega({ ...entrega, local: entrega.local.map((x, j) => (j === i ? { ...x, preco: e.target.value } : x)) })} />
              <input className={inputClasse} placeholder="Prazo (0 = hoje)" value={f.prazo} onChange={(e) => setEntrega({ ...entrega, local: entrega.local.map((x, j) => (j === i ? { ...x, prazo: e.target.value } : x)) })} />
              <input className={inputClasse} placeholder="Grátis acima de R$" value={f.gratis} onChange={(e) => setEntrega({ ...entrega, local: entrega.local.map((x, j) => (j === i ? { ...x, gratis: e.target.value } : x)) })} />
              <button className="btn-secundario" onClick={() => setEntrega({ ...entrega, local: entrega.local.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn-secundario" onClick={() => setEntrega({ ...entrega, local: [...entrega.local, { prefixos: "", nome: "Entrega local", preco: "", prazo: "0", gratis: "" }] })}>+ faixa local</button>
            <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", {
              retiradaNaLoja: entrega.retiradaNaLoja, despachoDiasUteis: entrega.despachoDiasUteis,
              freteGratisAcima: entrega.freteGratisAcima ? centavos(entrega.freteGratisAcima) : null,
              // Em branco, zero ou texto que não é número: sem mínimo.
              pedidoMinimoCentavos: centavos(entrega.pedidoMinimo) > 0 ? centavos(entrega.pedidoMinimo) : null,
              tabelaFrete: entrega.tabela.filter((f) => f.ufs && f.preco).map((f) => ({ ufs: f.ufs.split(",").map((u) => u.trim()).filter(Boolean), preco: centavos(f.preco), prazoDiasUteis: Number(f.prazo) || 7, nome: f.nome || undefined })),
              // Faixa sem prefixo é descartada aqui e ignorada na cotação: sem
              // isso ela valeria para todo CEP do país.
              entregaLocal: entrega.local
                .map((f) => ({ ...f, prefixos: f.prefixos.split(",").map((p) => p.replace(/\D/g, "")).filter(Boolean) }))
                .filter((f) => f.prefixos.length > 0 && f.nome.trim().length >= 2)
                .map((f) => ({ prefixos: f.prefixos, nome: f.nome.trim(), preco: f.preco ? centavos(f.preco) : 0, prazoDiasUteis: Number(f.prazo) || 0, gratisAcima: f.gratis ? centavos(f.gratis) : null })),
            })}>Salvar</button>
          </div>
        </Secao>
      )}

      {aba === "Recebimento" && (
        <Secao
          titulo={loja.mpOAuthDisponivel ? "Chaves da sua aplicação (avançado)" : "Recebimento (Mercado Pago)"}
          descricao={loja.mpOAuthDisponivel
            ? "Só para quem prefere usar a própria aplicação do Mercado Pago em vez de conectar a conta acima. Crie as credenciais em Mercado Pago → Suas integrações → Credenciais de produção."
            : "O dinheiro cai direto na sua conta. Crie as credenciais em Mercado Pago → Suas integrações → Credenciais de produção."}
        >
          {/* Com a conexão acima no ar, é ela que diz se a loja recebe; aqui o
              selo repetiria a mesma coisa duas vezes na tela. */}
          {loja.mpPorOAuth && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              A loja está conectada pelo Mercado Pago. Salvar chaves aqui substitui essa conexão.
            </p>
          )}
          <div className={`flex flex-wrap items-center gap-3 text-sm ${loja.mpPorOAuth ? "hidden" : ""}`}>
            {loja.mpConfigurado ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Recebendo</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Ainda não recebe</span>
            )}
            {!loja.mpConfigurado && <span className="text-muted-foreground">Sem isto, o cliente monta o carrinho e não consegue pagar.</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Public key"><input className={inputClasse} value={mp.publicKey} onChange={(e) => setMp({ ...mp, publicKey: e.target.value })} placeholder="APP_USR-…" /></Campo>
            <Campo label="Access token" ajuda={loja.mpConfigurado && !loja.mpPorOAuth ? "Já configurado. Preencha só para trocar." : undefined}><input className={inputClasse} type="password" value={mp.accessToken} onChange={(e) => setMp({ ...mp, accessToken: e.target.value })} placeholder="APP_USR-…" /></Campo>
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
              {loja.assinatura.emTeste
                ? `Sua loja está no período de teste até ${new Date(loja.assinatura.testeAte).toLocaleDateString("pt-BR")}. Escolha o plano e ative a cobrança para não interromper as vendas.`
                : `O período de teste terminou em ${new Date(loja.assinatura.testeAte).toLocaleDateString("pt-BR")}. Ative a cobrança para não interromper as vendas.`}
            </p>
          )}
          {!loja.assinatura.isenta && loja.assinatura.podeTrocarPlano && (
            <div className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="Plano">
              {PLANOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={loja.assinatura.plano === p.id}
                  disabled={ocupado || loja.assinatura.plano === p.id}
                  onClick={() => chamar("/api/painel/assinatura", "PATCH", { plano: p.id }, `Plano ${p.nome} escolhido.`)}
                  className={`rounded-xl border p-4 text-left text-sm transition ${loja.assinatura.plano === p.id ? "border-foreground bg-card shadow-sm" : "border-border hover:border-foreground/40"}`}
                >
                  <b className="block">{p.nome}</b>
                  <span className="block font-semibold tabular-nums">{mensalidade(p.preco)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{p.rotulo}</span>
                </button>
              ))}
            </div>
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
          {(!loja.razaoSocial || !loja.cnpj || !loja.endereco?.logradouro || !loja.endereco?.numero || !loja.endereco?.bairro || !loja.endereco?.cidade || !loja.endereco?.uf || loja.endereco?.cep?.replace(/\D/g, "").length !== 8) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Complete razão social, CNPJ e endereço físico. Esses dados identificam o vendedor nas políticas e nas informações comerciais da loja.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Razão social" ajuda="O nome que está no cartão CNPJ, não o nome fantasia."><input className={inputClasse} value={empresa.razaoSocial} onChange={(e) => setEmpresa({ ...empresa, razaoSocial: e.target.value })} placeholder="Vedashow Comércio de Vedações Ltda" /></Campo>
            <Campo label="CNPJ"><input className={inputClasse} value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} placeholder="00.000.000/0001-00" inputMode="numeric" /></Campo>
          </div>
          <div><button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", { razaoSocial: empresa.razaoSocial.trim() || null, cnpj: empresa.cnpj.trim() || null }, "Dados da empresa salvos.")}>Salvar</button></div>
        </Secao>
        <Secao titulo="Endereço da empresa e retirada" descricao="Mantenha o endereço correto para as informações legais, contato e cálculo de frete. O endereço aparece na página de contato quando a opção pública estiver ativa e nas políticas da loja.">
          {loja.retiradaNaLoja && !(enderecoEmpresa.logradouro && enderecoEmpresa.numero && enderecoEmpresa.cidade && enderecoEmpresa.uf && enderecoEmpresa.cep.replace(/\D/g, "").length === 8) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">A retirada está ativa, mas o endereço está incompleto. Preencha rua, número, cidade, UF e CEP para orientar os clientes.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="CEP"><input className={inputClasse} inputMode="numeric" value={enderecoEmpresa.cep} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, cep: e.target.value })} placeholder="00000-000" /></Campo>
            <Campo label="Logradouro"><input className={inputClasse} value={enderecoEmpresa.logradouro} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, logradouro: e.target.value })} placeholder="Rua ou avenida" /></Campo>
            <Campo label="Número"><input className={inputClasse} value={enderecoEmpresa.numero} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, numero: e.target.value })} /></Campo>
            <Campo label="Complemento"><input className={inputClasse} value={enderecoEmpresa.complemento} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, complemento: e.target.value })} /></Campo>
            <Campo label="Bairro"><input className={inputClasse} value={enderecoEmpresa.bairro} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, bairro: e.target.value })} /></Campo>
            <Campo label="Cidade"><input className={inputClasse} value={enderecoEmpresa.cidade} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, cidade: e.target.value })} /></Campo>
            <Campo label="UF"><input className={inputClasse} maxLength={2} value={enderecoEmpresa.uf} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, uf: e.target.value.toUpperCase() })} placeholder="SP" /></Campo>
            <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={enderecoEmpresa.enderecoPublico || loja.retiradaNaLoja} disabled={loja.retiradaNaLoja} onChange={(e) => setEnderecoEmpresa({ ...enderecoEmpresa, enderecoPublico: e.target.checked })} /> Mostrar endereço na página de contato{loja.retiradaNaLoja && <span className="text-muted-foreground">(obrigatório para retirada)</span>}</label>
          </div>
          <div><button className="btn-primario" disabled={ocupado} onClick={() => {
            const cep = enderecoEmpresa.cep.replace(/\D/g, "");
            chamar("/api/painel/loja", "PATCH", {
              endereco: { logradouro: enderecoEmpresa.logradouro.trim(), numero: enderecoEmpresa.numero.trim(), complemento: enderecoEmpresa.complemento.trim(), bairro: enderecoEmpresa.bairro.trim(), cidade: enderecoEmpresa.cidade.trim(), uf: enderecoEmpresa.uf.trim().slice(0, 2), ...(cep.length === 8 ? { cep } : {}) },
              ...(cep.length === 8 ? { cepOrigem: cep } : {}),
              enderecoPublico: enderecoEmpresa.enderecoPublico || loja.retiradaNaLoja,
            }, "Endereço salvo.");
          }}>Salvar endereço</button></div>
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
