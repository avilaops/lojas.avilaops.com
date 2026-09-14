import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo, salvarGradeNoCatalogo } from "../../src/lib/catalogo-escrita";
import { resolverItensPadronizados } from "../../src/lib/catalogo-resolver";
import { reservarEstoque, liberarReservas, confirmarEstoqueDoPedido } from "../../src/lib/catalogo-reservas";
import { INCLUIR_CATALOGO, diagnosticarProduto, midiasDaOferta } from "../../src/lib/catalogo-qualidade";
import { gerarFeedMerchant } from "../../src/lib/catalogo-merchant";

const url=new URL(process.env.DATABASE_URL??"http://invalid");
if(!["127.0.0.1","localhost"].includes(url.hostname)||url.port!=="5548"||!url.pathname.endsWith("_test")) throw new Error("Este teste exige o banco isolado local :5548/*_test.");
after(()=>prisma.$disconnect());
const chave=()=>randomUUID().replace(/-/g,"");
async function loja() { return prisma.tenant.create({data:{slug:`qa-${chave()}`,nome:"QA Catálogo",status:"ATIVA"}}); }
async function produto(tenantId:string, extras:Parameters<typeof salvarProdutoNoCatalogo>[2]={}) {
  return salvarProdutoNoCatalogo(tenantId,null,{nome:"Limpador QA 500ml",slug:`produto-${chave()}`,precoCentavos:4990,sku:`QA-${chave()}`,estoque:5,imagens:["https://example.com/frasco.webp"],descricao:"Limpador para teste do catálogo.",...extras});
}

test("simples tem variante, preço, saldo, mídia, histórico e evento; id antigo resolve a mesma oferta",async()=>{
  const t=await loja(),p=await produto(t.id);
  const completo=await prisma.produto.findUniqueOrThrow({where:{id:p.id},include:INCLUIR_CATALOGO});
  assert.equal(completo.variantes.length,1);
  const v=completo.variantes[0];
  assert.equal(v.padrao,true); assert.equal(v.preco?.valorCentavos,4990);assert.equal(v.saldos[0].fisico,5);
  assert.equal(completo.midias.length,1);assert.equal(completo.midias[0].correspondencia,"nao_confirmada");
  const itens=await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1}]);
  assert.equal(itens[0].id,`${p.id}:${v.id}`);assert.equal(itens[0].precoUnitario,4990);
  assert.equal(await prisma.eventoCatalogo.count({where:{produtoId:p.id}}),1);
  assert.equal(await prisma.historicoCatalogo.count({where:{produtoId:p.id}}),1);
});

test("edição tem versão, preço oficial e projeções consistentes; escrita legada é rejeitada",async()=>{
  const t=await loja(),p=await produto(t.id);
  const alterado=await salvarProdutoNoCatalogo(t.id,p.id,{precoCentavos:6990},{versao:p.versaoCatalogo});
  assert.equal(alterado.precoCentavos,6990);
  assert.equal((await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1}]))[0].precoUnitario,6990);
  await assert.rejects(()=>salvarProdutoNoCatalogo(t.id,p.id,{nome:"Antigo"},{versao:p.versaoCatalogo}),/mudou/);
  await assert.rejects(()=>prisma.produto.update({where:{id:p.id},data:{precoCentavos:1}}),/projeções/);
});

test("duas lojas não compartilham produto, categoria, SKU ou variante",async()=>{
  const a=await loja(),b=await loja(),p=await produto(a.id,{sku:"IGUAL"});
  await produto(b.id,{sku:"IGUAL"});
  await assert.rejects(()=>produto(a.id,{sku:"IGUAL"}));
  await assert.rejects(()=>salvarProdutoNoCatalogo(b.id,p.id,{nome:"Outro"}),/não encontrado/);
  assert.deepEqual(await resolverItensPadronizados(b.id,[{id:p.id,quantidade:1}]),[]);
  const categoria=await prisma.categoria.create({data:{tenantId:a.id,slug:"teste",nome:"Categoria"}});
  await assert.rejects(()=>produto(b.id,{categoriaId:categoria.id}),/não pertence/);
  const v=await prisma.variante.findFirstOrThrow({where:{produtoId:p.id}});
  await assert.rejects(()=>prisma.saldoEstoque.create({data:{tenantId:b.id,varianteId:v.id,local:"cruzado",fisico:1}}));
});

test("variações exigem preço próprio e combinação única; GTIN do pai não é replicado",async()=>{
  const t=await loja(),p=await produto(t.id,{gtin:"7898511024485"});
  await assert.rejects(()=>salvarGradeNoCatalogo(t.id,p.id,["Volume"],[{valores:{Volume:"5L"},precoCentavos:null}]),/próprio preço/);
  await assert.rejects(()=>salvarGradeNoCatalogo(t.id,p.id,["Volume"],[{valores:{Volume:"5L"},precoCentavos:10},{valores:{Volume:"5L"},precoCentavos:20}]),/repetidas/);
  const grade=await salvarGradeNoCatalogo(t.id,p.id,["Volume"],[{valores:{Volume:"500ml"},precoCentavos:1000,estoque:2},{valores:{Volume:"5L"},precoCentavos:2000,estoque:1}]);
  assert.equal(grade.variantes.length,2);assert.ok(grade.variantes.every(v=>v.gtin===null));
  assert.deepEqual(await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1}]),[]);
  assert.equal((await resolverItensPadronizados(t.id,[{id:`${p.id}:${grade.variantes[1].id}`,quantidade:1}]))[0].precoUnitario,2000);
  const c=await prisma.produto.findUniqueOrThrow({where:{id:p.id},include:INCLUIR_CATALOGO});
  const xml=gerarFeedMerchant(t,"https://qa.example",[c]);
  assert.equal((xml.match(/<item>/g)??[]).length,2); assert.ok(xml.includes("?variante=")); assert.ok(!xml.includes("<g:gtin>"));
  await assert.rejects(()=>salvarProdutoNoCatalogo(t.id,p.id,{precoCentavos:5}),/grade/);
});

test("feed mantém identidade externa e não afirma ausência de identificador nem aprovação",async()=>{
  const t=await loja(),p=await produto(t.id);
  const c=await prisma.produto.findUniqueOrThrow({where:{id:p.id},include:INCLUIR_CATALOGO});
  const xml=gerarFeedMerchant(t,"https://qa.example",[c]);
  assert.ok(xml.includes(`<g:id>${p.id}</g:id>`));assert.ok(!xml.includes("identifier_exists"));
  assert.ok(diagnosticarProduto(c).some(o=>o.regra==="identificador_desconhecido"));
  assert.equal(c.variantes[0].publicacoes[0].resultadoExterno,"NAO_CONSULTADO");
  await salvarProdutoNoCatalogo(t.id,p.id,{gtin:"1234567890123"});
  const invalido=await prisma.produto.findUniqueOrThrow({where:{id:p.id},include:INCLUIR_CATALOGO});
  assert.ok(diagnosticarProduto(invalido).some(o=>o.regra==="gtin_invalido"));
  assert.ok(!gerarFeedMerchant(t,"https://qa.example",[invalido]).includes("<item>"));
});

test("disputa pela última unidade e aliases duplicados: só uma reserva",async()=>{
  const t=await loja(),p=await produto(t.id,{estoque:1});
  const itens=await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1}]);
  assert.deepEqual(await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1},{id:itens[0].id,quantidade:1}]),[]);
  const refs=[chave(),chave()];
  const r=await Promise.allSettled(refs.map(ref=>reservarEstoque(t.id,ref,itens)));
  assert.equal(r.filter(x=>x.status==="fulfilled").length,1);
  const ref=refs[r.findIndex(x=>x.status==="fulfilled")];
  assert.deepEqual(await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1}]),[]);
  await assert.rejects(()=>reservarEstoque(t.id,ref,itens),/já foi recebida/);
  await Promise.all([liberarReservas(t.id,ref),liberarReservas(t.id,ref)]);
  assert.equal((await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1}])).length,1);
});

test("pagamento repetido só baixa uma vez e conserva os snapshots do pedido",async()=>{
  const t=await loja(),p=await produto(t.id,{estoque:2}),ref=chave();
  const itens=await resolverItensPadronizados(t.id,[{id:p.id,quantidade:1}]);
  await reservarEstoque(t.id,ref,itens);
  const pedido=await prisma.pedido.create({data:{tenantId:t.id,referencia:ref,clienteNome:"QA",clienteEmail:"qa@example.test",clienteTelefone:"5511999999999",clienteDocumento:"00000000000",freteNome:"Retirada",freteCentavos:0,subtotalCentavos:4990,totalCentavos:4990,meioPagamento:"pix",status:"PAGO",itens:{create:{produtoId:p.id,varianteId:itens[0].id.split(":")[1],nome:itens[0].nome,sku:itens[0].sku,quantidade:1,precoUnitarioCentavos:4990}}}});
  await Promise.all([confirmarEstoqueDoPedido(pedido.id),confirmarEstoqueDoPedido(pedido.id)]);
  assert.equal((await prisma.produto.findUniqueOrThrow({where:{id:p.id}})).estoque,1);
  assert.equal(await prisma.movimentoEstoque.count({where:{tenantId:t.id,motivo:"pedido_pago"}}),1);
  await salvarProdutoNoCatalogo(t.id,p.id,{nome:"Nome novo",precoCentavos:7990});
  const item=await prisma.pedidoItem.findFirstOrThrow({where:{pedidoId:pedido.id}});
  assert.equal(item.precoUnitarioCentavos,4990);assert.equal(item.nome,itens[0].nome);
});

test("foto própria e identificadores da variação alimentam feed, carrinho e busca",async()=>{
  const t=await loja(),p=await produto(t.id);
  const foto="https://example.com/5litros.webp";
  const grade=await salvarGradeNoCatalogo(t.id,p.id,["Volume"],[{valores:{Volume:"5L"},sku:"LIMPA5L",mpn:"FAB5000",precoCentavos:9000,estoque:3,imagem:foto},{valores:{Volume:"500ml"},sku:"LIMPA500ML",precoCentavos:1000,estoque:3,imagem:foto}]);
  const c=await prisma.produto.findUniqueOrThrow({where:{id:p.id},include:INCLUIR_CATALOGO});
  assert.equal(c.midias.filter(m=>m.url===foto).length,2);
  for(const v of grade.variantes)assert.equal(midiasDaOferta(c,v.id)[0].url,foto);
  assert.ok(c.busca.includes("limpa5l"));assert.ok(c.busca.includes("fab5000"));
  assert.ok(gerarFeedMerchant(t,"https://qa.example",[c]).includes(`<g:image_link>${foto}</g:image_link>`));
  assert.equal((await resolverItensPadronizados(t.id,[{id:`${p.id}:${grade.variantes[0].id}`,quantidade:1}]))[0].imagem,foto);
});

test("referência de cobrança não pode ser reutilizada por outra loja",async()=>{
  const a=await loja(),b=await loja(),pa=await produto(a.id),pb=await produto(b.id),ref=chave();
  await reservarEstoque(a.id,ref,await resolverItensPadronizados(a.id,[{id:pa.id,quantidade:1}]));
  await assert.rejects(()=>reservarEstoque(b.id,ref,[]),/inválida/);
  const itens=await resolverItensPadronizados(b.id,[{id:pb.id,quantidade:1}]);
  await assert.rejects(()=>reservarEstoque(b.id,ref,itens),/já foi recebida/);
  assert.equal((await prisma.produto.findUniqueOrThrow({where:{id:pb.id}})).estoque,5);
});
