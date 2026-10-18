export const VERSAO = '1.0.0';

export function validarLoja(entrada) {
  if (!entrada || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(entrada.slug ?? '')) {
    throw new Error('Loja precisa de slug válido.');
  }
  const url = new URL(entrada.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use a origem HTTPS pública, sem caminho, porta ou credenciais.');
  }
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname)
    || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)
    || /^\d+(?:\.\d+){3}$/.test(url.hostname)) {
    throw new Error('Domínio público inválido.');
  }
  const objetivo = entrada.objetivo ?? 'nao-definido';
  if (!['compra-online', 'pedido-assistido', 'nao-definido'].includes(objetivo)) {
    throw new Error('Objetivo comercial inválido.');
  }
  return { slug: entrada.slug, url: url.origin, objetivo, segmento: entrada.segmento ?? 'geral' };
}

export function atributos(tag) {
  const resultado = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    resultado[m[1].toLowerCase()] = m[2] ?? m[3];
  }
  return resultado;
}

export function extrairPagina(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => atributos(m[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => atributos(m[0]));
  const dados = [];
  const errosJsonLd = [];
  function adicionar(valor) {
    if (Array.isArray(valor)) return valor.forEach(adicionar);
    if (!valor || typeof valor !== 'object') return;
    if (Array.isArray(valor['@graph'])) valor['@graph'].forEach(adicionar);
    if (valor['@type']) dados.push(valor);
  }
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (atributos(m[1]).type?.toLowerCase() !== 'application/ld+json') continue;
    try { adicionar(JSON.parse(m[2])); } catch { errosJsonLd.push('JSON-LD inválido'); }
  }
  return {
    titulo: html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '',
    descricao: metas.find(m => m.name?.toLowerCase() === 'description')?.content ?? '',
    robots: metas.find(m => m.name?.toLowerCase() === 'robots')?.content ?? '',
    canonical: links.find(l => l.rel?.toLowerCase() === 'canonical')?.href ?? '',
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].length,
    dados, errosJsonLd,
  };
}

export function urlsDoSitemap(xml, origem) {
  const urls = [];
  let externas = 0;
  for (const m of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    try {
      const url = new URL(m[1].trim().replace(/&amp;/g, '&'));
      if (url.origin !== origem) { externas++; continue; }
      url.search = ''; url.hash = '';
      urls.push(url.href);
    } catch { externas++; }
  }
  return { urls: [...new Set(urls)], externas, indice: /<sitemapindex\b/i.test(xml) };
}

export function verificacao(id, estado, prioridade, url, esperado, observado) {
  return { id, estado, prioridade, url, esperado, observado };
}

export function analisarResposta(loja, recurso, resposta) {
  const { url, status, corpo = '', erro } = resposta;
  if (erro) return [verificacao(`${recurso}.http`, 'BLOQUEADO', 'P1', url,
    'Resposta HTTP verificável', erro)];
  const saida = [verificacao(`${recurso}.http`, status === 200 ? 'PASSOU' : 'FALHOU',
    recurso === 'home' ? 'P0' : 'P1', url, 'HTTP 200', `HTTP ${status}`)];
  if (status !== 200) return saida;
  if (recurso === 'home' || recurso === 'produto') {
    const p = extrairPagina(corpo);
    saida.push(verificacao(`${recurso}.titulo`, p.titulo ? 'PASSOU' : 'FALHOU', 'P2', url,
      'Title preenchido', p.titulo || 'Ausente'));
    saida.push(verificacao(`${recurso}.descricao`, p.descricao ? 'PASSOU' : 'FALHOU', 'P2', url,
      'Meta description preenchida', p.descricao || 'Ausente'));
    let canonicalCorreto = false;
    try { canonicalCorreto = new URL(p.canonical).origin === loja.url; } catch { /* ausente ou inválido */ }
    saida.push(verificacao(`${recurso}.canonical`, canonicalCorreto ? 'PASSOU' : 'FALHOU', 'P1', url,
      'Canonical no domínio auditado', p.canonical || 'Ausente'));
    saida.push(verificacao(`${recurso}.indexavel`, /noindex/i.test(p.robots) ? 'FALHOU' : 'PASSOU', 'P1', url,
      'Sem noindex na página pública; não comprova indexação real', p.robots || 'Meta robots ausente'));
    saida.push(verificacao(`${recurso}.h1`, p.h1 === 1 ? 'PASSOU' : 'FALHOU', 'P2', url,
      'Um H1', String(p.h1)));
    saida.push(verificacao(`${recurso}.jsonld`, p.errosJsonLd.length ? 'FALHOU' : p.dados.length ? 'PASSOU' : 'FALHOU', 'P2', url,
      'JSON-LD presente e sintaticamente válido', p.errosJsonLd.length ? p.errosJsonLd.join('; ') : `${p.dados.length} entidades`));
    if (recurso === 'produto') {
      const produto = p.dados.find(d => [d['@type']].flat().includes('Product'));
      saida.push(verificacao('produto.schema', produto ? 'PASSOU' : 'FALHOU', 'P1', url,
        'Entidade Product', produto ? 'Encontrada' : 'Ausente'));
      if (produto) {
        saida.push(verificacao('produto.imagens', [produto.image].flat().filter(Boolean).length ? 'PASSOU' : 'FALHOU', 'P1', url,
          'Imagem declarada; qualidade visual requer revisão', `${[produto.image].flat().filter(Boolean).length} referências`));
        const ofertas = [produto.offers].flat().filter(Boolean);
        saida.push(verificacao('produto.oferta', ofertas.length ? 'PASSOU' : 'NAO_TESTADO', 'P1', url,
          'Oferta ou decisão comercial sob consulta', ofertas.length ? 'Oferta declarada; estoque físico e cobrança não comprovados' : 'Sem Offer; verificar se é sob consulta'));
        if (loja.segmento === 'vedacoes') {
          const nomes = (produto.additionalProperty ?? []).map(a => a.name?.toLowerCase());
          for (const campo of ['Diâmetro interno', 'Diâmetro externo', 'Altura', 'Material', 'Aplicação']) {
            saida.push(verificacao(`vedacoes.${campo}`, nomes.includes(campo.toLowerCase()) ? 'PASSOU' : 'FALHOU', 'P1', url,
              `${campo} cadastrado; veracidade exige fonte técnica`, nomes.includes(campo.toLowerCase()) ? 'Presente no JSON-LD' : 'Não encontrado no JSON-LD'));
          }
        }
      }
    }
  }
  if (recurso === 'sitemap') {
    const mapa = urlsDoSitemap(corpo, loja.url);
    saida.push(verificacao('sitemap.urls', mapa.urls.length && !mapa.externas ? 'PASSOU' : 'FALHOU', 'P1', url,
      'URLs válidas do domínio', `${mapa.urls.length} URLs; ${mapa.externas} externas/inválidas`));
    if (mapa.indice) saida.push(verificacao('sitemap.indice', 'NAO_TESTADO', 'P2', url,
      'Percorrer sub-sitemaps', 'Índice detectado; sub-sitemaps não percorridos nesta versão'));
  }
  if (recurso === 'robots') {
    saida.push(verificacao('robots.sitemap', new RegExp(`^Sitemap:\\s*${loja.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml\\s*$`, 'im').test(corpo) ? 'PASSOU' : 'FALHOU', 'P2', url,
      'Sitemap do domínio declarado', corpo.match(/^Sitemap:.*$/im)?.[0] ?? 'Ausente'));
  }
  if (recurso === 'merchant') {
    const itens = [...corpo.matchAll(/<item(?:\s|>)/gi)].length;
    const estado = itens ? 'PASSOU' : loja.objetivo === 'compra-online' ? 'FALHOU' : 'NAO_TESTADO';
    saida.push(verificacao('merchant.ofertas', estado, 'P2', url,
      'Ofertas se a loja pretende compra online', `${itens} itens; não comprova aprovação no Merchant Center`));
  }
  return saida;
}

export function concluir(loja, testes) {
  const falhas = testes.filter(t => t.estado === 'FALHOU');
  const bloqueados = testes.filter(t => ['BLOQUEADO', 'NAO_TESTADO'].includes(t.estado));
  return {
    versao: VERSAO, executadoEm: new Date().toISOString(), loja,
    status: falhas.some(t => t.prioridade === 'P0') ? 'FALHA_CRITICA'
      : falhas.length ? 'COM_PENDENCIAS' : bloqueados.length ? 'PARCIAL' : 'VERIFICADO',
    prontidaoComercial: 'NAO_CERTIFICADA',
    cobertura: { passou: testes.filter(t => t.estado === 'PASSOU').length, falhou: falhas.length,
      bloqueado: testes.filter(t => t.estado === 'BLOQUEADO').length,
      naoTestado: testes.filter(t => t.estado === 'NAO_TESTADO').length },
    testes,
  };
}

export function revisoesPendentes(loja) {
  return [
    ['visual.desktop', 'Revisar hierarquia, legibilidade, contraste, fotos e navegação desktop'],
    ['visual.mobile', 'Revisar menu, busca, produto e carrinho mobile com capturas'],
    ['painel.acesso', 'Confirmar tenant e permissões de leitura; presença de credencial não prova funcionamento'],
    ['comercial.checkout', 'Testar carrinho, mínimo, frete e caminho de pagamento sem concluir compra'],
    ['catalogo.estoque', 'Conferir estoque, unidade de venda, preços e fonte das especificações'],
    ['busca.funcional', 'Testar código, texto, vírgula/ponto, parcial, vazio, inválido e categoria'],
    ['fotos.revisao', 'Classificar ausentes, repetidas, representativas e fotos reais necessárias'],
    ['seo.indexacao', 'Consultar Search Console e Merchant autenticados se disponíveis'],
    ['desempenho.cwv', 'Medir desempenho de navegador; HTTP não é LCP/INP/CLS'],
  ].map(([id, esperado]) => verificacao(id, 'NAO_TESTADO', 'P1', loja.url, esperado, 'Requer evidência adicional; não aprovado automaticamente'));
}

export function markdown(relatorio) {
  const limpar = valor => String(valor).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  return [`# Auditoria — ${relatorio.loja.slug}`, '',
    `Versão ${relatorio.versao} · ${relatorio.executadoEm}`, '',
    `Status técnico: **${relatorio.status}**. Prontidão comercial: **${relatorio.prontidaoComercial}**.`, '',
    `Loja: ${relatorio.loja.url}. Objetivo: ${relatorio.loja.objetivo}. Segmento: ${relatorio.loja.segmento}.`, '',
    'A coleta automática não substitui navegação, painel autenticado, confirmação técnica ou homologação de pagamento.', '',
    '| Teste | Estado | Prioridade | URL | Esperado | Observado |',
    '| --- | --- | --- | --- | --- | --- |',
    ...relatorio.testes.map(t => `| ${[t.id, t.estado, t.prioridade, t.url, t.esperado, t.observado].map(limpar).join(' | ')} |`),
    '', '## Próximas ações', '',
    ...relatorio.testes.filter(t => t.estado !== 'PASSOU').map(t => `- ${t.prioridade} · ${t.id}: ${t.esperado} (${t.estado}).`), '',
  ].join('\n');
}
