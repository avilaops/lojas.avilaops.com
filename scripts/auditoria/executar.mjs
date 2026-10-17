#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { validarLoja, analisarResposta, concluir, revisoesPendentes, urlsDoSitemap, markdown } from './core.mjs';

const [arquivo, destino = 'output/auditorias'] = process.argv.slice(2);
if (!arquivo) {
  console.error('Uso: node scripts/auditoria/executar.mjs lojas.json [diretorio-saida]');
  process.exit(2);
}

function ipPublico(ip) {
  if (ip.includes(':')) return /^(?:2|3)/i.test(ip) && !/^2001:db8:/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a !== 0 && a !== 10 && a !== 127 && a < 224
    && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && b === 168) && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 198 && (b === 18 || b === 19));
}

async function buscar(url) {
  const inicio = performance.now();
  try {
    const enderecos = await lookup(new URL(url).hostname, { all: true });
    if (!enderecos.length || enderecos.some(e => !ipPublico(e.address))) throw new Error('Destino não é público.');
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: { 'user-agent': 'AvilaOps-Auditoria/1.0 (read-only)' } });
    const reader = r.body?.getReader();
    const partes = [];
    let tamanho = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          tamanho += value.byteLength;
          if (tamanho > 5_000_000) throw new Error('Corpo excede limite de 5 MB.');
          partes.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => {}); }
    }
    return { url, status: r.status, corpo: Buffer.concat(partes).toString('utf8'),
      ms: Math.round(performance.now() - inicio), bytes: tamanho };
  } catch (e) {
    return { url, status: null, erro: e instanceof Error ? e.message : 'Falha de coleta',
      ms: Math.round(performance.now() - inicio) };
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(resolve(arquivo), 'utf8'));
  if (!Array.isArray(manifest.lojas) || manifest.lojas.length === 0) throw new Error('Manifesto precisa de lojas.');
  const lojas = manifest.lojas.map(validarLoja);
  if (new Set(lojas.map(l => l.slug)).size !== lojas.length) throw new Error('Slug duplicado no manifesto.');
  const pasta = resolve(destino, new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(pasta, { recursive: true });
  const indice = [];
  for (const loja of lojas) {
    const testes = [];
    const coletas = [];
    const recursos = [['home', '/'], ['robots', '/robots.txt'], ['sitemap', '/sitemap.xml'], ['merchant', '/feed/merchant.xml']];
    let sitemap;
    for (const [recurso, caminho] of recursos) {
      const resposta = await buscar(loja.url + caminho);
      testes.push(...analisarResposta(loja, recurso, resposta));
      coletas.push({ recurso, url: resposta.url, status: resposta.status, ms: resposta.ms, bytes: resposta.bytes ?? null });
      if (recurso === 'sitemap') sitemap = resposta;
    }
    const produtos = sitemap?.status === 200 ? urlsDoSitemap(sitemap.corpo, loja.url).urls
      .filter(url => new URL(url).pathname.startsWith('/produtos/')) : [];
    const amostra = produtos.slice(0, 3);
    for (const url of amostra) {
      const resposta = await buscar(url);
      testes.push(...analisarResposta(loja, 'produto', resposta));
      coletas.push({ recurso: 'produto', url, status: resposta.status, ms: resposta.ms, bytes: resposta.bytes ?? null });
    }
    testes.push(...revisoesPendentes(loja));
    const relatorio = { ...concluir(loja, testes), amostragem: { produtosNoSitemap: produtos.length,
      produtosInspecionados: amostra.length, criterio: 'Primeiros três do sitemap; não representa censo do catálogo' }, coletas };
    await writeFile(join(pasta, `${loja.slug}.json`), JSON.stringify(relatorio, null, 2) + '\n');
    await writeFile(join(pasta, `${loja.slug}.md`), markdown(relatorio));
    indice.push({ slug: loja.slug, status: relatorio.status, cobertura: relatorio.cobertura });
    console.log(`${loja.slug}: ${relatorio.status} (${testes.length} verificações)`);
  }
  await writeFile(join(pasta, 'indice.json'), JSON.stringify(indice, null, 2) + '\n');
  console.log(`Relatórios: ${pasta}`);
  process.exitCode = indice.some(i => i.cobertura.falhou || i.cobertura.bloqueado) ? 1 : 0;
}

main().catch(e => { console.error(e.message); process.exitCode = 2; });
