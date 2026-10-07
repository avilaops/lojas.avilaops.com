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
 *   - não inventa GTIN: só vai o que o dossiê traz com fonte;
 *   - não aplica item de confiança baixa sem `--incluir-baixa`;
 *   - não grava foto que não conseguiu extrair: o produto recebe texto e
 *     categoria, e o relatório lista o que ficou sem imagem.
 *
 * Dossiê: array com os campos que os pesquisadores produzem (ver
 * output/catalogo-padrao/brilhax-sem-foto-2026-10-07.json): sku, nomeAtual,
 * marca, nomeProposto, descricaoCurta, descricao, categoriaLoja,
 * googleProductCategory {id, caminho}, gtin, atributos, fontes,
 * paginaDasFotos, fotos, confianca, duvidas, aplicar (opcional, false pula).
 */

import { readFile, writeFile } from "node:fs/promises";

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

if (!loja || !dossiePath || typeof dossiePath !== "string") {
  console.error("uso: LOJAS_ADMIN_TOKEN=... node scripts/completar-catalogo-sem-foto.mjs --loja <slug> --dossie <arquivo.json> [--aplicar] [--incluir-baixa] [--sku 00120,00121] [--base https://lojas.avilaops.com]");
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
  if (item.confianca === "baixa" && !incluirBaixa) { pulados.push({ sku: item.sku, motivo: "confiança baixa (use --incluir-baixa)" }); continue; }
  const atual = (item.sku && porSku.get(item.sku)) || (item.slug && porSlug.get(item.slug));
  if (!atual) { pulados.push({ sku: item.sku, motivo: "não encontrado na loja (sku/slug)" }); continue; }
  if (atual.imagens?.length) { pulados.push({ sku: item.sku, motivo: "já tem foto na loja; nada a fazer aqui" }); continue; }

  const { fotos, origem, pagina } = await fotosDaFonte(item);
  const gtin = typeof item.gtin === "string" && gtinValido(item.gtin) ? item.gtin : undefined;
  const entrada = {
    sku: atual.sku ?? undefined,
    slug: atual.slug,
    nome: item.nomeProposto || atual.nome,
    // Preço atual de volta: o PUT exige o campo e não é esta rodada que o muda.
    precoCentavos: atual.precoCentavos,
    ...(item.marca ? { marca: item.marca } : {}),
    ...(item.categoriaLoja ? { categoria: item.categoriaLoja } : {}),
    ...(item.googleProductCategory?.id ? { googleProductCategory: String(item.googleProductCategory.id) } : {}),
    ...(gtin ? { gtin } : {}),
    ...(item.descricaoCurta ? { descricaoCurta: String(item.descricaoCurta).slice(0, 300) } : {}),
    ...(item.descricao ? { descricao: String(item.descricao).slice(0, 8000) } : {}),
    atributos: { ...(atual.atributos ?? {}), ...(item.atributos ?? {}), _catalogoFonte: pagina ?? item.fontes?.[0]?.url ?? "pesquisa 2026-10-07" },
    ...(fotos.length ? { imagens: fotos, imagemOrigem: "propria" } : {}),
  };
  plano.push({ sku: item.sku, nomeAtual: atual.nome, confianca: item.confianca, fotos: fotos.length, origemDasFotos: origem, duvidas: item.duvidas ?? [], entrada });
}

const planoPath = dossiePath.replace(/\.json$/, "") + ".plano.json";
await writeFile(planoPath, JSON.stringify({ geradoEm: new Date().toISOString(), loja, aplicar, plano, pulados }, null, 1));
console.log(`${plano.length} produtos no plano (${plano.filter((p) => p.fotos).length} com foto resolvida), ${pulados.length} pulados. Plano em ${planoPath}`);
for (const p of plano) console.log(`  ${p.sku ?? "-"}  ${p.fotos} foto(s) [${p.origemDasFotos}]  ${p.entrada.nome}`);
for (const p of pulados) console.log(`  pulado ${p.sku ?? "-"}: ${p.motivo}`);

if (!aplicar) { console.log("\nEnsaio. Rode com --aplicar para gravar."); process.exit(0); }

const resultados = [];
for (let i = 0; i < plano.length; i += 20) {
  const lote = plano.slice(i, i + 20).map((p) => p.entrada);
  const r = await fetch(`${base}/api/admin/tenants/${loja}/produtos?importarImagens=1`, { method: "PUT", headers: cabecalhos, body: JSON.stringify(lote) });
  const corpo = await r.json().catch(() => ({}));
  resultados.push({ lote: i / 20 + 1, status: r.status, corpo });
  console.log(`lote ${i / 20 + 1}: HTTP ${r.status}`, JSON.stringify(corpo).slice(0, 600));
  if (!r.ok) break;
}
await writeFile(planoPath.replace(/\.plano\.json$/, ".resultado.json"), JSON.stringify({ aplicadoEm: new Date().toISOString(), loja, resultados }, null, 1));
