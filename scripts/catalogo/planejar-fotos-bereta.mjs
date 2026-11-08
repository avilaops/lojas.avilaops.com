#!/usr/bin/env node
/** Produz dossiê auditável; não altera banco nem baixa imagens sem correspondência. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function acabamentoDoNome(nome) {
  const n = nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
  if (/\b(FUME|SMOKE|BDS|BDF|FOSCO|FOSCA|SHADOW)\b/.test(n)) return null;
  if (/\bPRET[AO]\s+DIAM(?:ANTAD[AO])?\b/.test(n)) return "BD";
  if (/\bGRAFITE\s+DIAM(?:ANTAD[AO])?\b/.test(n)) return "GD";
  return n.match(/\b(BD|GD|HD|HG|SS|GF|BF)\b/)?.[1] ?? null;
}

export function imagemKrmai(midia) {
  if (!/\.(png|jpe?g|webp)$/i.test(new URL(midia.source_url).pathname)) return null;
  const nome = midia.title.rendered.replace(/\s+/g, "").toUpperCase();
  const m = nome.match(/^([KMRS]\d+)[_-]?(?:G[_-])?(BD|GD|HD|HG|SS|GF|BF|B)(?:[_-]([GP]))?[_-]?$/);
  if (!m) return null;
  return { modelo: m[1], acabamento: m[2], tamanho: m[3], url: midia.source_url, pagina: `https://kr-wheels.com/rodas/${m[1].toLowerCase()}/` };
}

export function planejar(produtos, midias) {
  const indice = midias.map(imagemKrmai).filter(Boolean);
  const resultado = [];
  for (const p of produtos) {
    if (p.imagens.length || !["rodas", "pneus"].includes(p.categoria?.slug)) continue;
    const base = { id: p.id, sku: p.sku, nome: p.nome, slug: p.slug, ativo: p.ativo, categoria: p.categoria.slug, marca: p.marca };
    if (/\b(SEMI\s*NOV[AO]|USAD[AO]|COMISSAO|SERVICO|MONTAGEM)\b/i.test(p.nome.normalize("NFD").replace(/\p{Diacritic}/gu, ""))) {
      resultado.push({ ...base, estado: "foto-propria-necessaria", motivo: "Estado físico ou serviço não pode ser representado por foto de produto novo." }); continue;
    }
    if (p.marca === "KRMAI" && p.categoria.slug === "rodas") {
      const modelo = p.atributos?.modelo;
      const acabamento = acabamentoDoNome(p.nome);
      const imagem = indice.filter(i => i.modelo === modelo && i.acabamento === acabamento).sort((a,b) => Number(b.tamanho === "G") - Number(a.tamanho === "G"))[0];
      if (imagem) {
        resultado.push({ ...base, estado: "correspondencia-de-serie", imagemOrigem: "representativa", imagemFamilia: `${p.marca} ${modelo} ${acabamento}`, fotos: [imagem.url], pagina: imagem.pagina, criterio: "Modelo e acabamento explícitos; medidas e furação não confirmados pela fotografia de série." }); continue;
      }
    }
    resultado.push({ ...base, estado: "pendente-pesquisa", motivo: "Exige fonte com modelo, acabamento e identificação suficientes." });
  }
  return resultado;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [snapshot, midias, saida] = process.argv.slice(2);
  if (!snapshot || !midias || !saida) throw new Error("Informe snapshot JSON, mídia KRMAI JSON e arquivo de saída.");
  const { produtos } = JSON.parse(await readFile(snapshot, "utf8"));
  const plano = planejar(produtos, JSON.parse(await readFile(midias, "utf8")));
  await writeFile(saida, JSON.stringify({ geradoEm: new Date().toISOString(), loja: "bereta-rodas", itens: plano }, null, 2));
  console.log(JSON.stringify(plano.reduce((acc,p) => ({ ...acc, [p.estado]: (acc[p.estado] ?? 0) + 1 }), {})));
}
