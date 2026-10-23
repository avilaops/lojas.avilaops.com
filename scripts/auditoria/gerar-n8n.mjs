import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = new URL('./', import.meta.url);
const core = (await readFile(new URL('core.mjs', base), 'utf8')).replace(/^export /gm, '');
const preparar = core + `
const entradas = $input.all().flatMap(item => Array.isArray(item.json) ? item.json : [item.json]);
const recursos = [['home', '/'], ['robots', '/robots.txt'], ['sitemap', '/sitemap.xml'], ['merchant', '/feed/merchant.xml']];
const saida = [];
for (const entrada of entradas) {
  const dominio = entrada.dominioPrincipal || entrada.slug + '.lojas.avilaops.com';
  const loja = validarLoja({ slug: entrada.slug, url: 'https://' + dominio,
    segmento: entrada.slug === 'pkvedacoes' ? 'vedacoes' : 'geral', objetivo: 'nao-definido', statusPlataforma: entrada.status });
  const administrativo = { slug: entrada.slug, status: entrada.status ?? null, plano: entrada.plano ?? null,
    segmentoCadastrado: entrada.segmento ?? null, layout: entrada.tema?.layout ?? null,
    produtos: entrada._count?.produtos ?? null, pedidos: entrada._count?.pedidos ?? null,
    categorias: entrada._count?.categorias ?? null, minimoCentavos: entrada.pedidoMinimoCentavos ?? null,
    retirada: entrada.retiradaNaLoja ?? null, cepOrigemPreenchido: Boolean(entrada.cepOrigem),
    faixasFrete: Array.isArray(entrada.tabelaFrete) ? entrada.tabelaFrete.length : null,
    faixasEntregaLocal: Array.isArray(entrada.entregaLocal) ? entrada.entregaLocal.length : null,
    provedorPadrao: entrada.provedorPadrao ?? null, chavePublicaMpPresente: Boolean(entrada.mpPublicKey),
    meiosPagamento: Array.isArray(entrada.meiosPagamento) ? entrada.meiosPagamento : [],
    recebimentoHomologado: 'NAO_TESTADO' };
  for (const [recurso, caminho] of recursos) saida.push({ json: { loja, administrativo, recurso, url: loja.url + caminho } });
}
return saida;
`;
const analisar = core + `
const contexto = $('Preparar verificacoes').item.json;
const resposta = $json;
const testes = analisarResposta(contexto.loja, contexto.recurso, { url: contexto.url,
  status: resposta.statusCode ?? null,
  corpo: typeof resposta.body === 'string' ? resposta.body : typeof resposta.data === 'string' ? resposta.data : '',
  erro: resposta.error ? 'Falha de coleta HTTP; consultar execução no n8n' : undefined });
return { json: { loja: contexto.loja, administrativo: contexto.administrativo, recurso: contexto.recurso, testes } };
`;
const consolidar = core + `
const grupos = new Map();
for (const item of $input.all()) {
  const { loja, testes, administrativo } = item.json;
  if (!grupos.has(loja.slug)) grupos.set(loja.slug, { loja, administrativo, testes: [] });
  grupos.get(loja.slug).testes.push(...testes);
}
return [...grupos.values()].map(grupo => {
  const administrativo = grupo.administrativo;
  const revisoes = revisoesPendentes(grupo.loja).map(t => t.id === 'painel.acesso'
    ? { ...t, estado: 'PASSOU', observado: 'GET administrativo autenticado por tenant confirmado. Operações de escrita não testadas.' } : t);
  const extras = [];
  if (grupo.loja.statusPlataforma === 'ATIVA' && administrativo?.produtos === 0) {
    extras.push(verificacao('catalogo.vazio', 'FALHOU', 'P1', grupo.loja.url, 'Catálogo cadastrado para vender', 'Zero produtos no cadastro administrativo.'));
  }
  const relatorio = concluir(grupo.loja, [...grupo.testes, ...revisoes, ...extras]);
  return { json: { ...relatorio, administrativo, escopo: 'triagem-http-e-cadastro',
    limitações: 'Sem navegação, fotos, produto amostrado, estoque ou pagamento homologado. Objetivo comercial ainda não definido.',
    markdown: markdown(relatorio) } };
});
`;
const codigo = `const inicio = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Iniciar auditoria manual', parameters: {} }, output: [{}] });
const listar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Listar lojas autorizadas', parameters: {
  method: 'GET', url: 'https://lojas.avilaops.com/api/admin/tenants', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth',
  options: { timeout: 20000, redirect: { redirect: { followRedirects: false } } }
}, credentials: { httpBearerAuth: { id: 'BIftJgoyPwxr2d55', name: 'Lojas Admin Token' } } }, output: [{ slug: 'pkvedacoes', dominioPrincipal: 'pkvedacoes.com.br' }] });
const preparar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Preparar verificacoes', parameters: { mode: 'runOnceForAllItems', jsCode: ${JSON.stringify(preparar)} } }, output: [{ loja: { slug: 'pkvedacoes', url: 'https://pkvedacoes.com.br', objetivo: 'nao-definido', segmento: 'vedacoes' }, recurso: 'home', url: 'https://pkvedacoes.com.br/' }] });
const cadastro = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Consultar cadastro por loja', parameters: {
  method: 'GET', url: expr('https://lojas.avilaops.com/api/admin/tenants/{{ $json.slug }}'), authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth',
  options: { timeout: 20000, redirect: { redirect: { followRedirects: false } }, batching: { batch: { batchSize: 1, batchInterval: 300 } } }
}, credentials: { httpBearerAuth: { id: 'BIftJgoyPwxr2d55', name: 'Lojas Admin Token' } } }, output: [{ slug: 'pkvedacoes', dominioPrincipal: 'pkvedacoes.com.br', status: 'ATIVA', _count: { produtos: 803, pedidos: 0 } }] });
const consultar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Consultar paginas publicas', onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: expr('{{ $json.url }}'), authentication: 'none', options: { timeout: 20000,
    redirect: { redirect: { followRedirects: false } }, batching: { batch: { batchSize: 1, batchInterval: 300 } },
    response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } } }
} }, output: [{ body: '<html><title>Loja</title></html>', statusCode: 200 }] });
const avaliar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Avaliar evidencias', parameters: { mode: 'runOnceForEachItem', jsCode: ${JSON.stringify(analisar)} } }, output: [{ loja: { slug: 'pkvedacoes', url: 'https://pkvedacoes.com.br', objetivo: 'nao-definido', segmento: 'vedacoes' }, recurso: 'home', testes: [] }] });
const relatorio = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Relatorio por loja', parameters: { mode: 'runOnceForAllItems', jsCode: ${JSON.stringify(consolidar)} } }, output: [{ versao: '1.0.0', prontidaoComercial: 'NAO_CERTIFICADA', status: 'PARCIAL' }] });
export default workflow('auditoria-lojas-v1', '[Lojas] Auditoria tecnica — Todas as lojas').add(inicio).to(listar).to(cadastro).to(preparar).to(consultar).to(avaliar).to(relatorio)
  .group('Coleta publica', [preparar, consultar, avaliar], { description: 'GET por loja; erros de coleta ficam bloqueados e não viram aprovação.' });
`;
const destino = new URL('workflow.n8n.js', base);
await writeFile(destino, codigo);
console.log(fileURLToPath(destino));
