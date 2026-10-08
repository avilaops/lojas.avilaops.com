#!/usr/bin/env node
/**
 * Aplica um dossiê de complemento de catálogo (nome, marca, descrição,
 * categoria, categoria Google, GTIN, atributos e fotos) nos produtos de uma
 * loja, pela API administrativa.
 *
 *   LOJAS_ADMIN_TOKEN=... node scripts/completar-catalogo-sem-foto.mjs \
 *     --loja brilhax --dossie output/catalogo-padrao/brilhax-sem-foto-2026-10-07.json
 *
 * Sem `--aplicar` é só ensaio: baixa o catálogo atual, resolve as fotos a
 * partir das páginas-fonte e grava o plano em `<dossie>.plano.json`, sem
 * escrever nada na loja. Com `--aplicar`, envia o plano em lotes de 20 por
 * `PUT /api/admin/tenants/<loja>/produtos?importarImagens=1`, que copia as
 * fotos para o nosso /uploads (a loja deixa de depender do site de origem).
 *
 * O que o script NÃO faz, de propósito:
 *   - não ativa produto nem mexe em preço, estoque ou destaque: o PUT recebe
 *     o preço atual de volta, e campo não enviado fica como está;
 *   - não inventa GTIN: só vai o que o dossiê traz com fonte, e nenhum
 *     GTIN/MPN entra enquanto o dossiê duvidar da unidade de venda (caixa x
 *     unidade) sem `unidadeVendaConfirmada: true`;
 *   - foto `propria` só com fonte do fabricante ou distribuidor: anúncio de
 *     marketplace como única fonte não vira foto própria (`imagemLicenciada`
 *     declarado é a exceção);
 *   - não aplica item de confiança baixa sem `--incluir-baixa`;
 *   - não grava foto que não conseguiu extrair: o produto recebe texto e
 *     categoria, e o relatório lista o que ficou sem imagem;
 *   - não troca a categoria da loja sem `--mudar-categoria`: a importação
 *     casa categoria pelo slug do nome, e "Rolamento" no dossiê renomearia a
 *     prateleira "Rolamentos" inteira;
 *   - respeita a honestidade da imagem: item com `fotoExata: false` só recebe
 *     foto como `representativa`, e só quando o dossiê diz a `imagemFamilia`;
 *     sem família, fica sem foto (é a regra da plataforma, ver AGENTS.md).
 *
 * Dossiê: array com os campos que os pesquisadores produzem (ver
 * output/catalogo-padrao/brilhax-sem-foto-2026-10-07.json): sku, nomeAtual,
 * marca, nomeProposto, descricaoCurta, descricao, categoriaLoja,
 * googleProductCategory {id, caminho}, gtin, atributos, fontes,
 * paginaDasFotos, fotos, confianca, duvidas, aplicar (opcional, false pula).
 */

import { readFile, writeFile } from "node:fs/promises";
import { fonteSoDeMarketplace, fotoPodeSerPropria, identificadoresPermitidos } from "./lib/dossie-regras.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const loja = args.loja;
const dossiePath = args.dossie;
const base = (args.base ?? "https://lojas.avilaops.com").replace(/\/$/, "");
const token = process.env.LOJAS_ADMIN_TOKEN;
const aplicar = args.aplicar === true;
const incluirBaixa = args["incluir-baixa"] === true;
const somenteSku = typeof args.sku === "string" ? new Set(args.sku.split(",")) : null;
const mudarCategoria = args["mudar-categoria"] === true;

if (!loja || !dossiePath || typeof dossiePath !== "string") {
  console.error("uso: LOJAS_ADMIN_TOKEN=... node scripts/completar-catalogo-sem-foto.mjs --loja <slug> --dossie <arquivo.json> [--aplicar] [--incluir-baixa] [--mudar-categoria] [--sku 00120,00121] [--base https://lojas.avilaops.com]");
  process.exit(2);
}
if (!token) {
  console.error("Defina LOJAS_ADMIN_TOKEN no ambiente (nunca em arquivo versionado).");
  process.exit(2);
}

const cabecalhos = { authorization: `Bearer ${token}`, "content-type": "application/json" };

async function catalogoAtual() {
  const r = await fetch(`${base}/api/admin/tenants/${loja}/produtos`, { headers: cabecalhos });
  if (!r.ok) throw new Error(`GET produtos: HTTP ${r.status}`);
  return r.json();
}

/**
 * Fotos de uma página de produto, na ordem de confiança: JSON-LD `Product.image`
 * (é o que o próprio site declara ao Google), depois `og:image`, depois as
 * `<img>` cujo endereço parece foto de produto. Nada de miniatura, ícone,
 * logo ou bandeira de pagamento.
 */
function extrairFotos(html, urlPagina) {
  const achadas = [];
  const absoluta = (u) => { try { return new URL(u.replace(/&amp;/g, "&"), urlPagina).toString(); } catch { return null; } };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const bloco = JSON.parse(m[1].trim());
      const nos = [].concat(bloco, bloco?.["@graph"] ?? []).filter(Boolean);
      for (const no of nos) {
        if (!/Product/i.test(String(no?.["@type"] ?? ""))) continue;
        const imagens = [].concat(no.image ?? []).map((i) => (typeof i === "string" ? i : i?.url ?? i?.contentUrl)).filter(Boolean);
        achadas.push(...imagens);
      }
    } catch { /* bloco inválido: ignora */ }
  }
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi)) achadas.push(m[1]);
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi)) achadas.push(m[1]);
  if (achadas.length === 0) {
    for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) {
      if (!/(logo|icon|favicon|bandeira|flag|selo|badge|sprite|banner|thumb|\b\d{2,3}x\d{2,3}\b)/i.test(m[1])) achadas.push(m[1]);
    }
  }
  const vistas = new Set();
  return achadas.map(absoluta).filter((u) => u && /^https:\/\//.test(u) && !vistas.has(u) && (vistas.add(u), true)).slice(0, 10);
}

async function fotosDaFonte(item) {
  if (Array.isArray(item.fotos) && item.fotos.length) return { fotos: item.fotos.slice(0, 10), origem: "dossie" };
  const pagina = item.paginaDasFotos || item.fontes?.find((f) => f.tipo === "fabricante")?.url || item.fontes?.[0]?.url;
  if (!pagina) return { fotos: [], origem: "sem pagina" };
  try {
    const r = await fetch(pagina, { headers: { "user-agent": "Mozilla/5.0 (compatible; LojasAvilaOps-catalogo/1.0; +https://lojas.avilaops.com)" }, redirect: "follow" });
    if (!r.ok) return { fotos: [], origem: `pagina HTTP ${r.status}`, pagina };
    const fotos = extrairFotos(await r.text(), pagina);
    return { fotos, origem: fotos.length ? "pagina" : "pagina sem foto reconhecida", pagina };
  } catch (e) {
    return { fotos: [], origem: `pagina falhou: ${e instanceof Error ? e.message : String(e)}`, pagina };
  }
}

function gtinValido(valor) {
  if (!valor || !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(valor) || /^0+$/.test(valor)) return false;
  const d = valor.split("").map(Number);
  const v = d.pop();
  const soma = d.reverse().reduce((n, x, i) => n + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === v;
}

const dossie = JSON.parse(await readFile(dossiePath, "utf8"));
const atuais = await catalogoAtual();
const porSku = new Map(atuais.filter((p) => p.sku).map((p) => [p.sku, p]));
const porSlug = new Map(atuais.map((p) => [p.slug, p]));

const plano = [];
const pulados = [];
for (const item of dossie) {
  if (item.aplicar === false) { pulados.push({ sku: item.sku, motivo: "aplicar=false no dossiê" }); continue; }
  if (somenteSku && !somenteSku.has(item.sku)) continue;
  if (item.confianca === "nao_pesquisado") { pulados.push({ sku: item.sku, motivo: "não pesquisado" }); continue; }
  if (item.confianca === "baixa" && !incluirBaixa) { pulados.push({ sku: item.sku, motivo: "confiança baixa (use --incluir-baixa)" }); continue; }
  const atual = (item.sku && porSku.get(item.sku)) || (item.slug && porSlug.get(item.slug));
  if (!atual) { pulados.push({ sku: item.sku, motivo: "não encontrado na loja (sku/slug)" }); continue; }
  if (atual.imagens?.length) { pulados.push({ sku: item.sku, motivo: "já tem foto na loja; nada a fazer aqui" }); continue; }

  // Dúvida de unidade de venda (caixa x unidade x metro) com GTIN/MPN no
  // dossiê: o identificador é da unidade, e aplicá-lo à caixa é identidade
  // comercial errada no Merchant. Sem `unidadeVendaConfirmada: true`, o item
  // inteiro espera: trocar só o nome e manter o preço da caixa confundiria
  // tanto quanto. Ver scripts/lib/dossie-regras.mjs.
  if ((item.gtin || item.mpn) && !identificadoresPermitidos(item)) { pulados.push({ sku: item.sku, motivo: "GTIN/MPN com dúvida de unidade de venda; confirme a quantidade e marque unidadeVendaConfirmada" }); continue; }

  // Origem da imagem: exata (`propria`) só com foto exata E fonte que não
  // seja apenas anúncio de terceiro (marketplace), salvo licença declarada;
  // o dossiê pode rebaixar para representativa (precisa da família) ou negar.
  const exata = fotoPodeSerPropria(item);
  const familia = typeof item.imagemFamilia === "string" && item.imagemFamilia.trim() ? item.imagemFamilia.trim() : null;
  const podeFoto = exata || Boolean(familia);
  const motivoSemFoto = !exata && fonteSoDeMarketplace(item) && item.fotoExata === true ? "única fonte é marketplace: foto não entra como própria" : item.fotoExata === true ? "foto não entra" : "foto não declarada exata (fotoExata: true) e sem família: não entra";
  const { fotos, origem, pagina } = podeFoto ? await fotosDaFonte(item) : { fotos: [], origem: motivoSemFoto, pagina: undefined };
  const gtin = typeof item.gtin === "string" && gtinValido(item.gtin) ? item.gtin : undefined;
  const mpn = typeof item.mpn === "string" && item.mpn.trim() ? item.mpn.trim().slice(0, 60) : undefined;
  const categoriaAtual = atual.categoria?.nome ?? null;
  const trocaCategoria = mudarCategoria && item.categoriaLoja && item.categoriaLoja !== categoriaAtual;
  const entrada = {
    sku: atual.sku ?? undefined,
    slug: atual.slug,
    nome: item.nomeProposto || atual.nome,
    // Preço atual de volta: o PUT exige o campo e não é esta rodada que o muda.
    precoCentavos: atual.precoCentavos,
    ...(item.marca ? { marca: item.marca } : {}),
    ...(trocaCategoria ? { categoria: item.categoriaLoja } : {}),
    ...(item.googleProductCategory?.id ? { googleProductCategory: String(item.googleProductCategory.id) } : {}),
    ...(gtin ? { gtin } : {}),
    ...(mpn ? { mpn, identificadoresEstado: "informado" } : {}),
    ...(item.descricaoCurta ? { descricaoCurta: String(item.descricaoCurta).slice(0, 300) } : {}),
    ...(item.descricao ? { descricao: String(item.descricao).slice(0, 8000) } : {}),
    atributos: { ...(atual.atributos ?? {}), ...(item.atributos ?? {}), _catalogoFonte: pagina ?? item.fontes?.[0]?.url ?? "pesquisa 2026-10-07" },
    ...(fotos.length ? (exata ? { imagens: fotos, imagemOrigem: "propria" } : { imagens: fotos, imagemOrigem: "representativa", imagemFamilia: familia }) : {}),
  };
  plano.push({ sku: item.sku, nomeAtual: atual.nome, confianca: item.confianca, fotos: fotos.length, imagemOrigem: fotos.length ? (exata ? "propria" : "representativa") : null, origemDasFotos: origem, categoriaAtual, categoriaProposta: item.categoriaLoja ?? null, categoriaEnviada: Boolean(trocaCategoria), duvidas: item.duvidas ?? [], entrada });
}

const planoPath = dossiePath.replace(/\.json$/, "") + ".plano.json";
await writeFile(planoPath, JSON.stringify({ geradoEm: new Date().toISOString(), loja, aplicar, plano, pulados }, null, 1));
console.log(`${plano.length} produtos no plano (${plano.filter((p) => p.fotos).length} com foto resolvida), ${pulados.length} pulados. Plano em ${planoPath}`);
for (const p of plano) console.log(`  ${p.sku ?? "-"}  ${p.fotos} foto(s) [${p.origemDasFotos}]  ${p.entrada.nome}`);
for (const p of pulados) console.log(`  pulado ${p.sku ?? "-"}: ${p.motivo}`);

if (!aplicar) { console.log("\nEnsaio. Rode com --aplicar para gravar."); process.exit(0); }

const resultados = [];
// A rota responde 200 mesmo quando não consegue copiar uma imagem: ela guarda
// a URL externa em `imagens` e lista o problema em `imagens.falhas`. Foto que
// não chegou a /uploads não é própria nem representativa: é a vitrine
// dependendo do site de terceiro. Esses produtos voltam para "sem foto" no
// mesmo ato, e o script termina com erro para ninguém ler o 200 como sucesso.
const fotosNaoCopiadas = [];
for (let i = 0; i < plano.length; i += 20) {
  const fatia = plano.slice(i, i + 20);
  const lote = fatia.map((p) => p.entrada);
  const r = await fetch(`${base}/api/admin/tenants/${loja}/produtos?importarImagens=1`, { method: "PUT", headers: cabecalhos, body: JSON.stringify(lote) });
  const corpo = await r.json().catch(() => ({}));
  resultados.push({ lote: i / 20 + 1, status: r.status, corpo });
  console.log(`lote ${i / 20 + 1}: HTTP ${r.status}`, JSON.stringify(corpo).slice(0, 600));
  if (!r.ok) break;
  const falhas = Array.isArray(corpo?.imagens?.falhas) ? corpo.imagens.falhas : [];
  if (!falhas.length) continue;
  // A rota identifica a falha pelo nome do produto ("<nome>: <erro>").
  const comFalha = fatia.filter((p) => falhas.some((f) => typeof f === "string" && f.startsWith(`${p.entrada.nome}:`)));
  if (!comFalha.length) { fotosNaoCopiadas.push(...falhas.map((f) => ({ sku: null, falha: f }))); continue; }
  const desfazer = comFalha.map((p) => ({ sku: p.entrada.sku, slug: p.entrada.slug, nome: p.entrada.nome, precoCentavos: p.entrada.precoCentavos, imagens: [], imagemOrigem: "propria", imagemFamilia: null }));
  const r2 = await fetch(`${base}/api/admin/tenants/${loja}/produtos`, { method: "PUT", headers: cabecalhos, body: JSON.stringify(desfazer) });
  for (const p of comFalha) fotosNaoCopiadas.push({ sku: p.sku, nome: p.entrada.nome, falhas: falhas.filter((f) => f.startsWith(`${p.entrada.nome}:`)), fotoRemovida: r2.ok });
  console.log(`  ${comFalha.length} produto(s) ficaram sem foto porque a cópia falhou (HTTP ${r2.status} ao desfazer): ${comFalha.map((p) => p.sku).join(", ")}`);
}
await writeFile(planoPath.replace(/\.plano\.json$/, ".resultado.json"), JSON.stringify({ aplicadoEm: new Date().toISOString(), loja, resultados, fotosNaoCopiadas }, null, 1));
if (fotosNaoCopiadas.length) { console.error(`${fotosNaoCopiadas.length} foto(s) não copiada(s) para /uploads; os produtos voltaram a ficar sem foto. Veja .resultado.json.`); process.exit(1); }
