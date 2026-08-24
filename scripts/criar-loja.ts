/**
 * Cria uma loja pela API administrativa a partir de um JSON.
 *
 *   npx tsx scripts/criar-loja.ts loja.json [produtos.json] [--provisionar]
 *
 * loja.json segue TenantEntradaSchema; produtos.json é ProdutoEntrada[].
 * Precisa de LOJAS_API_URL (padrão http://127.0.0.1:3070) e LOJAS_ADMIN_TOKEN.
 */
import { readFileSync } from "node:fs";

const API = process.env.LOJAS_API_URL ?? "http://127.0.0.1:3070";
const TOKEN = process.env.LOJAS_ADMIN_TOKEN;
if (!TOKEN) throw new Error("LOJAS_ADMIN_TOKEN ausente");

const [arquivoLoja, arquivoProdutos] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const provisionar = process.argv.includes("--provisionar");
if (!arquivoLoja) throw new Error("uso: criar-loja.ts loja.json [produtos.json] [--provisionar]");

const headers = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };

async function main() {
  const loja = JSON.parse(readFileSync(arquivoLoja, "utf8"));
  const r = await fetch(`${API}/api/admin/tenants${provisionar ? "?provisionar=1" : ""}`, { method: "POST", headers, body: JSON.stringify(loja) });
  const corpo = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(corpo, null, 2));
  console.log("loja:", corpo);

  if (arquivoProdutos) {
    const produtos = JSON.parse(readFileSync(arquivoProdutos, "utf8"));
    const p = await fetch(`${API}/api/admin/tenants/${loja.slug}/produtos`, { method: "PUT", headers, body: JSON.stringify(produtos) });
    console.log("produtos:", await p.json());
  }
}

main();
