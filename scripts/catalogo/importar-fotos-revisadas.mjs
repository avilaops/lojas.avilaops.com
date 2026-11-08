#!/usr/bin/env node
/** Dossiê -> importação exclusiva de fotos. Sem --aplicar, apenas grava o plano. */
import { readFile, writeFile } from "node:fs/promises";
const [arquivo] = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!arquivo) throw new Error("Informe o dossiê JSON revisado e, para executar, --aplicar.");
const token = process.env.LOJAS_ADMIN_TOKEN;
if (!token) throw new Error("LOJAS_ADMIN_TOKEN ausente; nunca grave a chave no dossiê.");
const dossie = JSON.parse(await readFile(arquivo, "utf8"));
if (dossie.loja !== "bereta-rodas") throw new Error("Este dossiê deve pertencer à Bereta Rodas.");
const origem = "https://lojas.avilaops.com";
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const resposta = await fetch(`${origem}/api/admin/tenants/${dossie.loja}/produtos`, { headers, signal: AbortSignal.timeout(30000) });
if (!resposta.ok) throw new Error(`Catálogo: HTTP ${resposta.status}`);
const catalogo = new Map((await resposta.json()).map(p => [p.id,p]));
const plano = [];
for (const item of dossie.itens) {
  if (item.estado !== "correspondencia-de-serie" || item.revisado !== true) continue;
  const atual = catalogo.get(item.id);
  if (!atual || atual.nome !== item.nome || atual.sku !== item.sku || atual.imagens.length) continue;
  plano.push({ produtoId: atual.id, sku: atual.sku, nome: atual.nome, versaoCatalogo: atual.versaoCatalogo, imagemUrl: item.fotos[0], pagina: item.pagina, familia: item.imagemFamilia, criterio: item.criterio });
}
await writeFile(`${arquivo}.plano.json`, JSON.stringify(plano, null, 2));
console.log(`Fotos revisadas elegíveis: ${plano.length}`);
if (process.argv.includes("--aplicar")) {
  const resultados = [];
  for (let i = 0; i < plano.length; i += 5) {
    const r = await fetch(`${origem}/api/admin/tenants/${dossie.loja}/produtos/fotos`, { method: "POST", headers, body: JSON.stringify(plano.slice(i,i+5)), signal: AbortSignal.timeout(150000) });
    if (!r.ok) throw new Error(`Importação: HTTP ${r.status}; execução interrompida sem repetir o lote.`);
    const lote = await r.json(); resultados.push(...lote.resultados);
    await writeFile(`${arquivo}.resultado.json`, JSON.stringify(resultados, null, 2));
    console.log(`Processados ${resultados.length}/${plano.length}`);
  }
}
