import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ErroCatalogo, INCLUIR_OFERTA, ofertaDaVariante, validarGrade } from "./catalogo-oferta";

type Tx = Prisma.TransactionClient;
type CamposProduto = Partial<Omit<Prisma.ProdutoUncheckedCreateInput, "id" | "tenantId" | "variantes" | "itens" | "midias" | "historicoCatalogo" | "versaoCatalogo" | "criadoEm" | "atualizadoEm">> & { mpn?: string|null; identificadoresEstado?: string };
export const CAMPOS_COMERCIAIS = ["sku", "gtin", "precoCentavos", "precoDeCentavos", "estoque", "pesoKg", "alturaCm", "larguraCm", "comprimentoCm", "disponibilidade"] as const;
const CAMPOS_MIDIA = ["imagens", "imagemOrigem", "imagemFamilia"] as const;
const snapshot = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export async function permitirProjecao(tx: Tx) {
  await tx.$executeRaw`SELECT set_config('lojas.catalogo_escrita', 'on', true)`;
}

export async function travarProduto(tx: Tx, tenantId: string, id: string) {
  await tx.$queryRaw`SELECT id FROM "Produto" WHERE id=${id} AND "tenantId"=${tenantId} FOR UPDATE`;
  const p = await tx.produto.findFirst({ where: { id, tenantId }, include: { variantes: { include: INCLUIR_OFERTA }, midias: true } });
  if (!p) throw new ErroCatalogo("Produto não encontrado nesta loja.", 404);
  return p;
}

export async function atualizarProjecao(tx: Tx, tenantId: string, produtoId: string) {
  await permitirProjecao(tx);
  const vs = await tx.variante.findMany({ where: { tenantId, produtoId }, include: INCLUIR_OFERTA, orderBy: [{ ordem: "asc" }, { id: "asc" }] });
  const ofertas = vs.map(ofertaDaVariante);
  for (const v of ofertas) await tx.variante.update({ where: { id: v.id }, data: { precoCentavos: v.precoCentavos, estoque: v.estoque } });
  const ativas = ofertas.filter(v => v.ativo);
  const principal = ativas.find(v => v.padrao) ?? [...ativas].sort((a,b) => Number(b.compravel)-Number(a.compravel) || a.precoCentavos-b.precoCentavos || a.id.localeCompare(b.id))[0];
  const midias = await tx.midiaProduto.findMany({ where: { tenantId, produtoId, varianteId: null, tipo: "imagem" }, orderBy: [{ ordem: "asc" }, { id: "asc" }] });
  return tx.produto.update({ where: { id: produtoId }, data: {
    sku: principal?.padrao ? principal.sku : null, gtin: principal?.padrao ? principal.gtin : null,
    precoCentavos: principal?.precoCentavos ?? 0, precoDeCentavos: principal?.precoDeCentavos ?? null,
    estoque: principal?.estoque ?? null, disponibilidade: principal?.disponibilidade ?? "out_of_stock",
    pesoKg: principal?.pesoKg ?? null, alturaCm: principal?.alturaCm ?? null, larguraCm: principal?.larguraCm ?? null, comprimentoCm: principal?.comprimentoCm ?? null,
    imagens: midias.map(m=>m.url), imagemOrigem: midias[0]?.origem ?? "propria", imagemFamilia: midias[0]?.familia ?? null,
  } });
}

async function registrar(tx: Tx, tenantId: string, produtoId: string, antes: unknown, campos: string[], origem: string) {
  const p = await tx.produto.update({ where: { id: produtoId }, data: { versaoCatalogo: { increment: 1 } } });
  const depois = await tx.produto.findUniqueOrThrow({ where: { id: produtoId }, include: { variantes: { include: INCLUIR_OFERTA }, midias: true } });
  await tx.historicoCatalogo.create({ data: { tenantId, produtoId, versao: p.versaoCatalogo, origem, campos, antes: snapshot(antes), depois: snapshot(depois) } });
  await tx.eventoCatalogo.create({ data: { tenantId, produtoId, versao: p.versaoCatalogo } });
  return p;
}

async function gravarSaldo(tx: Tx, tenantId: string, varianteId: string, fisico: number | null, motivo: string) {
  const where = { tenantId_varianteId_local: { tenantId, varianteId, local: "principal" } };
  const antes = await tx.saldoEstoque.findUnique({ where });
  if (antes && antes.reservado > 0 && (fisico == null || fisico < antes.reservado)) throw new ErroCatalogo("Há unidades reservadas. O saldo físico não pode ser menor que as reservas nem perder o controle de estoque.");
  await tx.saldoEstoque.upsert({ where, create: { tenantId, varianteId, fisico }, update: { fisico } });
  if (antes?.fisico !== fisico) await tx.movimentoEstoque.create({ data: { tenantId, varianteId, chave: `ajuste:${crypto.randomUUID()}`, quantidade: (fisico ?? 0) - (antes?.fisico ?? 0), motivo } });
}

type MetadadosMidia = { fonte: string; correspondencia?: "nao_confirmada" | "confirmada" | "rejeitada"; somentePrincipal?: boolean };

async function gravarMidiasLegadas(tx: Tx, p: Awaited<ReturnType<typeof travarProduto>>, campos: CamposProduto, metadados?: MetadadosMidia) {
  if (!CAMPOS_MIDIA.some(k => campos[k] !== undefined) && !metadados?.correspondencia) return;
  const urls = [...new Set((campos.imagens as string[] | undefined ?? p.imagens).map(u=>u.trim()).filter(Boolean))];
  const origem = campos.imagemOrigem ?? p.imagemOrigem;
  const familia = campos.imagemFamilia !== undefined ? campos.imagemFamilia : p.imagemFamilia;
  if (origem === "representativa" && !familia) throw new ErroCatalogo("Informe a família da imagem representativa.");
  // URLs removidas saem do vínculo; o arquivo original não é apagado.
  await tx.midiaProduto.deleteMany({ where: { tenantId: p.tenantId, produtoId: p.id, varianteId: null, url: { notIn: urls } } });
  for (const [ordem, url] of urls.entries()) {
    const existente = p.midias.find(m=>m.url===url && !m.varianteId);
    const dadosConfirmacao = metadados && (!metadados.somentePrincipal || ordem === 0)
      ? { fonte: metadados.fonte, ...(metadados.correspondencia ? { correspondencia: metadados.correspondencia } : {}) }
      : undefined;
    await tx.midiaProduto.upsert({ where: { produtoId_escopo_url: { produtoId: p.id, escopo: "produto", url } },
      create: { tenantId: p.tenantId, produtoId: p.id, url, ordem, origem, familia, finalidade: ordem===0 ? "principal" : "galeria", fonte: dadosConfirmacao?.fonte ?? "cadastro", correspondencia: dadosConfirmacao?.correspondencia ?? "nao_confirmada" },
      update: { ordem, origem, familia, finalidade: ordem===0 ? "principal" : "galeria", ...(dadosConfirmacao ? dadosConfirmacao : existente?.origem !== origem ? { correspondencia: "nao_confirmada" } : {}) },
    });
  }
}

/** Única escrita comercial de painel, importação e MCP. Legado é só projeção. */
export async function salvarProdutoNoCatalogo(tenantId: string, id: string | null, campos: CamposProduto, contexto: { origem?: string; versao?: number; metadadosMidia?: MetadadosMidia; exigirSemImagem?: boolean } = {}) {
  return prisma.$transaction(async tx => {
    await permitirProjecao(tx);
    if (campos.categoriaId && !await tx.categoria.findFirst({ where: { id: campos.categoriaId, tenantId } })) throw new ErroCatalogo("Categoria não pertence à loja.");
    if (campos.opcoes && (campos.opcoes as string[]).length) throw new ErroCatalogo("Cadastre as opções e as variações juntas pela grade.");
    if (!id) {
      if (!campos.nome || !campos.slug) throw new ErroCatalogo("Nome e endereço do produto são obrigatórios.");
      const { mpn: _mpn, identificadoresEstado: _estado, ...camposAntigos } = campos;
      void _mpn; void _estado;
      const criado = await tx.produto.create({ data: { ...camposAntigos, nome: campos.nome, slug: campos.slug, precoCentavos: campos.precoCentavos ?? 0, tenantId } });
      id = criado.id;
      const v = await tx.variante.create({ data: { tenantId, produtoId: id, padrao: true, nome: "Apresentação única", valores: {}, sku: criado.sku || null, gtin: criado.gtin || null,
        identificadoresEstado: criado.gtin ? "informado" : "desconhecido", disponibilidade: criado.disponibilidade,
        pesoKg: criado.pesoKg, alturaCm: criado.alturaCm, larguraCm: criado.larguraCm, comprimentoCm: criado.comprimentoCm,
        preco: { create: { valorCentavos: criado.precoCentavos, comparacaoCentavos: criado.precoDeCentavos } },
        saldos: { create: { fisico: criado.estoque } },
      } });
      await tx.publicacaoCanal.create({ data: { tenantId, varianteId: v.id, canal: "google", idExterno: id } });
    }
    const p = await travarProduto(tx, tenantId, id);
    if (contexto.versao !== undefined && p.versaoCatalogo !== contexto.versao) throw new ErroCatalogo("Este produto mudou desde que você abriu o cadastro. Recarregue antes de salvar.", 409);
    if (contexto.exigirSemImagem && p.imagens.length > 0) throw new ErroCatalogo("Este produto já recebeu uma imagem. Recarregue o cadastro antes de associar outra.", 409);
    const simples = p.variantes.find(v=>v.padrao && v.ativo);
    const editorial = { ...campos };
    delete editorial.mpn;
    delete editorial.identificadoresEstado;
    for (const k of [...CAMPOS_COMERCIAIS, ...CAMPOS_MIDIA]) delete editorial[k];
    if (!simples && CAMPOS_COMERCIAIS.some(k => campos[k] !== undefined && campos[k] !== p[k])) throw new ErroCatalogo("Este produto tem variações. Edite identificação, preço, estoque e embalagem na grade de variações.");
    await tx.produto.update({ where: { id }, data: editorial });
    if (simples) {
      const identificacao: Prisma.VarianteUpdateInput = {};
      for (const k of ["sku", "gtin", "pesoKg", "alturaCm", "larguraCm", "comprimentoCm", "disponibilidade"] as const) if (campos[k] !== undefined) Object.assign(identificacao, { [k]: campos[k] === "" ? null : campos[k] });
      if (campos.gtin !== undefined && campos.gtin !== simples.gtin) identificacao.identificadoresEstado = campos.gtin ? "informado" : "desconhecido";
      if (campos.mpn !== undefined) identificacao.mpn = campos.mpn || null;
      if (campos.identificadoresEstado !== undefined) identificacao.identificadoresEstado = campos.identificadoresEstado;
      await tx.variante.update({ where: { id: simples.id }, data: identificacao });
      await tx.precoVariante.update({ where: { varianteId: simples.id }, data: {
        ...(campos.precoCentavos !== undefined ? { valorCentavos: campos.precoCentavos } : {}),
        ...(campos.precoDeCentavos !== undefined ? { comparacaoCentavos: campos.precoDeCentavos } : {}),
      } });
      if (campos.estoque !== undefined) await gravarSaldo(tx, tenantId, simples.id, campos.estoque, contexto.origem ?? "cadastro");
    }
    await gravarMidiasLegadas(tx, p, campos, contexto.metadadosMidia);
    await atualizarProjecao(tx, tenantId, id);
    return registrar(tx, tenantId, id, p, Object.keys(campos), contexto.origem ?? "api");
  }, { timeout: 20000 });
}

export type AjusteDeOferta = { precoCentavos?: number; precoDeCentavos?: number | null; estoque?: number | null };

export type ResultadoDoAjuste =
  | { mudou: false; produtoId: string }
  | { mudou: true; produtoId: string; versao: number };

/**
 * Preço e estoque de uma variação — a apresentação única do produto simples
 * inclusive —, sem tocar no resto do cadastro.
 *
 * É a escrita que um ERP faz o dia inteiro, por SKU. `salvarProdutoNoCatalogo`
 * recusa produto com grade, e `salvarGradeNoCatalogo` reescreve a grade toda:
 * nenhuma das duas serve para "o SKU X agora custa Y e tem Z". Passa pelos
 * mesmos trilhos — trava do produto, saldo físico com reservas conferidas,
 * projeção, histórico e evento de catálogo.
 *
 * `estoque` é o saldo **físico** do local principal (o que o ERP conta na
 * prateleira); o disponível que a vitrine lê é físico menos reservado.
 *
 * Sem mudança, não grava nada: sincronização de ERP manda o catálogo inteiro
 * a cada passada, e sem isto cada passada viraria uma versão nova de cada
 * produto no histórico.
 */
export async function ajustarOfertaNoCatalogo(tenantId: string, varianteId: string, ajuste: AjusteDeOferta, origem: string): Promise<ResultadoDoAjuste> {
  return prisma.$transaction(async tx => {
    await permitirProjecao(tx);
    const alvo = await tx.variante.findFirst({ where: { id: varianteId, tenantId }, select: { produtoId: true } });
    if (!alvo) throw new ErroCatalogo("Variação não encontrada nesta loja.", 404);
    const p = await travarProduto(tx, tenantId, alvo.produtoId);
    const v = p.variantes.find(x => x.id === varianteId)!;
    if (!v.ativo) throw new ErroCatalogo("Esta variação está desativada no cadastro.", 409);

    const saldo = v.saldos.find(s => s.local === "principal");
    const mudaPreco = ajuste.precoCentavos !== undefined && ajuste.precoCentavos !== v.preco?.valorCentavos;
    const mudaPrecoDe = ajuste.precoDeCentavos !== undefined && ajuste.precoDeCentavos !== (v.preco?.comparacaoCentavos ?? null);
    const mudaEstoque = ajuste.estoque !== undefined && (!saldo || ajuste.estoque !== saldo.fisico);
    if (!mudaPreco && !mudaPrecoDe && !mudaEstoque) return { mudou: false, produtoId: p.id };

    if (mudaPreco || mudaPrecoDe) {
      const valorCentavos = ajuste.precoCentavos ?? v.preco?.valorCentavos ?? 0;
      const comparacaoCentavos = ajuste.precoDeCentavos !== undefined ? ajuste.precoDeCentavos : v.preco?.comparacaoCentavos ?? null;
      await tx.precoVariante.upsert({ where: { varianteId }, create: { tenantId, varianteId, valorCentavos, comparacaoCentavos }, update: { valorCentavos, comparacaoCentavos } });
    }
    if (mudaEstoque) await gravarSaldo(tx, tenantId, varianteId, ajuste.estoque!, origem);
    await atualizarProjecao(tx, tenantId, p.id);
    const campos = [...(mudaPreco ? ["precoCentavos"] : []), ...(mudaPrecoDe ? ["precoDeCentavos"] : []), ...(mudaEstoque ? ["estoque"] : [])];
    const registrado = await registrar(tx, tenantId, p.id, p, campos, origem);
    return { mudou: true, produtoId: p.id, versao: registrado.versaoCatalogo };
  }, { timeout: 20000 });
}

export type EntradaVariante = {
  id?: string; valores: Record<string,string>; sku?: string|null; gtin?: string|null; mpn?: string|null; identificadoresEstado?: string;
  precoCentavos?: number|null; precoDeCentavos?: number|null; estoque?: number|null; pesoKg?: number|null; alturaCm?: number|null; larguraCm?: number|null; comprimentoCm?: number|null;
  imagem?: string|null; disponibilidade?: string;
};

export async function salvarGradeNoCatalogo(tenantId: string, produtoId: string, opcoes: string[], variantes: EntradaVariante[], versao?: number) {
  validarGrade(opcoes, variantes);
  return prisma.$transaction(async tx => {
    await permitirProjecao(tx);
    const p = await travarProduto(tx, tenantId, produtoId);
    if (versao !== undefined && p.versaoCatalogo !== versao) throw new ErroCatalogo("O produto mudou. Recarregue a grade antes de salvar.", 409);
    const mantidos: string[] = [];
    for (const [ordem, entrada] of variantes.entries()) {
      const anterior = entrada.id ? p.variantes.find(v=>v.id===entrada.id && !v.padrao) : null;
      if (entrada.id && !anterior) throw new ErroCatalogo("Variação não pertence a este produto.", 404);
      const { precoCentavos, precoDeCentavos, estoque, ...dados } = entrada;
      const identificacao = { ...dados, id: undefined, sku: dados.sku || null, nome: opcoes.map(o=>entrada.valores[o]).join(" / "), ativo: true, ordem,
        identificadoresEstado: dados.identificadoresEstado ?? (dados.gtin ? "informado" : "desconhecido") };
      const v = anterior ? await tx.variante.update({ where: { id: anterior.id }, data: identificacao }) : await tx.variante.create({ data: { ...identificacao, tenantId, produtoId } });
      if (entrada.imagem !== undefined) {
        const url = entrada.imagem?.trim() || null;
        await tx.midiaProduto.deleteMany({ where: { tenantId, produtoId, varianteId: v.id, finalidade: "principal", ...(url ? { url: { not: url } } : {}) } });
        if (url) await tx.midiaProduto.upsert({ where: { produtoId_escopo_url: { produtoId, escopo: v.id, url } },
          create: { tenantId, produtoId, varianteId: v.id, escopo: v.id, url, finalidade: "principal", fonte: "grade" }, update: { finalidade: "principal", ordem: 0 } });
      }
      await tx.precoVariante.upsert({ where: { varianteId: v.id }, create: { tenantId, varianteId: v.id, valorCentavos: precoCentavos!, comparacaoCentavos: precoDeCentavos ?? null }, update: { valorCentavos: precoCentavos!, ...(precoDeCentavos !== undefined ? { comparacaoCentavos: precoDeCentavos } : {}) } });
      if (estoque !== undefined || !anterior) await gravarSaldo(tx, tenantId, v.id, estoque ?? null, "grade");
      await tx.publicacaoCanal.upsert({ where: { tenantId_varianteId_canal_contaExterna: { tenantId, varianteId: v.id, canal: "google", contaExterna: "" } }, create: { tenantId, varianteId: v.id, canal: "google", idExterno: `${produtoId}:${v.id}` }, update: {} });
      mantidos.push(v.id);
    }
    if (!variantes.length) {
      const padrao = p.variantes.find(v=>v.padrao);
      if (!padrao) throw new ErroCatalogo("Escolha os dados comerciais da apresentação única antes de retirar as variações.");
      mantidos.push(padrao.id);
      await tx.variante.update({ where: { id: padrao.id }, data: { ativo: true } });
    }
    if (await tx.reservaEstoque.count({ where: { tenantId, varianteId: { in: p.variantes.filter(v=>!mantidos.includes(v.id)).map(v=>v.id) }, estado: "ATIVA" } })) throw new ErroCatalogo("Há reservas nas variações removidas. Aguarde a conclusão dos pedidos.");
    await tx.variante.updateMany({ where: { tenantId, produtoId, id: { notIn: mantidos } }, data: { ativo: false } });
    await tx.produto.update({ where: { id: produtoId }, data: { opcoes: variantes.length ? opcoes : [] } });
    await atualizarProjecao(tx, tenantId, produtoId);
    await registrar(tx, tenantId, produtoId, p, ["variantes", "opcoes"], "grade");
    return tx.produto.findUniqueOrThrow({ where: { id: produtoId }, include: { variantes: { where: { ativo: true }, orderBy: { ordem: "asc" } } } });
  }, { timeout: 20000 });
}

export function respostaErroCatalogo(e: unknown): Response {
  if (e instanceof ErroCatalogo) return Response.json({ erro: e.message }, { status: e.status });
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return Response.json({ erro: "Já existe um produto ou variação com esse SKU, URL ou combinação nesta loja." }, { status: 409 });
  throw e;
}
