import Link from "next/link";
import { codigoPublico, rotuloDoCodigo } from "@/lib/codigo-publico";
import { notFound, permanentRedirect } from "next/navigation";
import FichaTecnica from "@/components/FichaTecnica";
import { lerDefinicoes, lerValores } from "@/lib/campos-personalizados";
import { exigirTenant, lojaVende, urlDaLoja, temaDo, retiradaPublicaDisponivel } from "@/lib/tenant";
import GaleriaPremium from "@/components/templates/automotivo-premium/Galeria";
import { buscarProduto, equivalentesDoProduto, formatarBRL, listarProdutos, mesmaSerie, resumoAvaliacoes, slugDoEquivalente } from "@/lib/catalogo";
import * as regras from "@/lib/produto-regras";
import { fichaDoProduto } from "@/lib/ficha";
import AvisoEstoque from "@/components/AvisoEstoque";
import EstoqueBaixo from "@/components/EstoqueBaixo";
import AddToCartButton from "@/components/cart/AddToCartButton";
import SeletorVariante from "@/components/SeletorVariante";
import GaleriaProduto from "@/components/GaleriaProduto";
import Avaliacoes from "@/components/Avaliacoes";
import EventoVerProduto from "@/components/EventoVerProduto";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { mensagemDoProduto } from "@/lib/whatsapp-produto";
import Compatibilidade from "@/components/Compatibilidade";
import Medicamento from "@/components/Medicamento";
import { ehMedicamento, exigeReceita, lerMedicamento, vendaRemotaProibida } from "@/lib/farmacia";
import { minhaMoto } from "@/lib/minha-moto";
import { lerCompatibilidade } from "@/lib/motos";
import { descricaoDoProduto, textoPuro } from "@/lib/seo-texto";
import { ofertaDaVariante,gtinValido } from "@/lib/catalogo-oferta";
import { midiasDaOferta } from "@/lib/catalogo-qualidade";
import { marcaConfirmada } from "@/lib/marca-confirmada";

type Props = { params: Promise<{ slug: string }>; searchParams:Promise<{variante?:string}> };

export async function generateMetadata({ params }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const p = await buscarProduto(t.id, slug);
  if (!p) return { title: "Produto" };
  // Catálogo importado quase nunca traz descrição curta: sem o fallback para a
  // longa, a página ficava sem meta description. Ver lib/seo-texto.
  const description = descricaoDoProduto(p);
  return {
    title: p.nome,
    ...(description ? { description } : {}),
    alternates: { canonical: `/produtos/${p.slug}` },
    openGraph: { images: p.imagens.slice(0, 1), ...(description ? { description } : {}) },
    // A mesma régua do sitemap: o que fica fora dele também pede para não ser
    // indexado, senão o Google chega pelo link interno e indexa do mesmo jeito.
    ...(regras.publicavel(p) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ProdutoPage({ params,searchParams }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const p = await buscarProduto(t.id, slug);
  if (!p) {
    // Cadastro repetido fora da vitrine: o link antigo leva ao que ficou.
    const destino = await slugDoEquivalente(t.id, slug);
    if (destino) permanentRedirect(`/produtos/${destino}`);
    notFound();
  }
  const {variante:varianteId}=await searchParams;
  const ofertas=p.variantes.filter(v=>v.ativo).map(ofertaDaVariante);
  const escolhida=ofertas.find(v=>v.id===varianteId)??ofertas.find(v=>v.padrao);
  if(varianteId&&!ofertas.some(v=>v.id===varianteId))notFound();
  if(escolhida)Object.assign(p,{precoCentavos:escolhida.precoCentavos,precoDeCentavos:escolhida.precoDeCentavos,estoque:escolhida.estoque,sku:escolhida.sku,gtin:escolhida.gtin,disponibilidade:escolhida.disponibilidade,imagens:midiasDaOferta(p,escolhida.id).map(m=>m.url)});
  const vende = lojaVende(t);
  // Preço zero é "ainda não precificado", não "de graça": item de referência
  // vindo do ERP entra no catálogo para ser encontrado, e o preço vem por
  // consulta. Ver ProductCard, que aplica a mesma regra na vitrine.
  // Mesma régua do card: antes a página ignorava `estoque` e oferecia
  // "Comprar" para peça zerada, que o checkout recusava em seguida.
  const sobConsulta = regras.sobConsulta(p);
  // A mesma resposta do card e da busca: selo, linha de estoque e botão.
  const estado = regras.estadoDeVenda(p, { vende });
  const moto = t.segmento === "motopecas" ? await minhaMoto() : null;
  // Farmácia: a tarja é o que decide se este item pode ser dispensado pela
  // internet. Tarja preta e tarja vermelha com retenção são de controle
  // especial, e a RDC 44/2009 (art. 62) veda a venda a distância — a página
  // continua existindo, com preço e bula, porque quem procura precisa achar e
  // saber que a loja tem. Ver src/lib/farmacia.ts.
  const medicamento = lerMedicamento(p);
  const somenteNaLoja = vendaRemotaProibida(medicamento.tarja);
  const [avaliacoes, resumo, relacionados, equivalentes, serie] = await Promise.all([
    prisma.avaliacao.findMany({ where: { produtoId: p.id, aprovada: true }, orderBy: { criadoEm: "desc" }, take: 20 }),
    resumoAvaliacoes(p.id),
    listarProdutos(t.id, { categoriaSlug: p.categoria?.slug, excetoId: p.id, limite: 4, moto }),
    // Só a loja de farmácia pergunta: nas outras o campo está vazio e a
    // consulta seria uma ida ao banco por visita para nunca devolver nada.
    t.segmento === "farmacia" ? equivalentesDoProduto(t.id, p) : Promise.resolve([]),
    // Outras medidas da mesma peça. Só existe onde o catálogo declarou a
    // família da imagem; sem ela, a página cai na lista da categoria.
    mesmaSerie(t.id, p),
  ]);
  const compat = lerCompatibilidade(p.compatibilidade);
  const ficha = fichaDoProduto((p.atributos as Record<string, unknown>) ?? {});

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nome,
    ...(marcaConfirmada(p.marca) ? { brand: { "@type": "Brand", name: marcaConfirmada(p.marca)! } } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(gtinValido(p.gtin) ? { gtin: p.gtin } : {}),
    ...(escolhida?.mpn ? { mpn: escolhida.mpn } : {}),
    ...(compat.length ? { isAccessoryOrSparePartFor: compat.map((c) => ({ "@type": "Vehicle", name: `${c.marca} ${c.modelo}`, brand: { "@type": "Brand", name: c.marca }, model: c.modelo })) } : {}),
    image: p.imagens,
    // Texto puro: a descrição importada vem com HTML, e tag dentro do JSON-LD
    // aparece literal no rich result.
    description: textoPuro(p.descricaoCurta ?? p.descricao) || undefined,
    ...(p.categoria ? { category: p.categoria.nome } : {}),
    // As medidas e características que a ficha visível mostra, como
    // PropertyValue: o mesmo dado, legível por máquina. Nada aqui é inventado;
    // se a ficha não tem, isto não tem.
    ...(ficha.length
      ? {
          additionalProperty: ficha.map((l) => ({
            "@type": "PropertyValue",
            name: l.rotulo,
            value: l.numero ?? l.valor,
            ...(l.unidade === "mm" ? { unitCode: "MMT", unitText: "mm" } : {}),
          })),
        }
      : {}),
    ...(resumo.media != null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: resumo.media, reviewCount: resumo.total } } : {}),
    offers: escolhida && p.precoCentavos > 0 ? {
      "@type": "Offer",
      url: `${urlDaLoja(t)}/produtos/${p.slug}${escolhida&&!escolhida.padrao?`?variante=${encodeURIComponent(escolhida.id)}`:""}`,
      priceCurrency: "BRL",
      price: (p.precoCentavos / 100).toFixed(2),
      // O feed diz `condition=new` para todo item; a marcação acompanha.
      itemCondition: "https://schema.org/NewCondition",
      availability: somenteNaLoja ? "https://schema.org/InStoreOnly" : `https://schema.org/${regras.disponibilidadeSchema(p)}`,
      seller: { "@id": `${urlDaLoja(t)}/#organization` },
    } : ofertas.some(v=>v.precoCentavos>0) ? {
      "@type": "AggregateOffer",
      priceCurrency: "BRL",
      lowPrice: (Math.min(...ofertas.filter(v=>v.precoCentavos>0).map(v=>v.precoCentavos))/100).toFixed(2),
      highPrice: (Math.max(...ofertas.map(v=>v.precoCentavos))/100).toFixed(2),
      offerCount: ofertas.filter(v=>v.precoCentavos>0).length,
      offers: ofertas.filter(v=>v.precoCentavos>0).map(v=>({
        "@type":"Offer",sku:v.sku??undefined,
        url:`${urlDaLoja(t)}/produtos/${p.slug}?variante=${encodeURIComponent(v.id)}`,
        priceCurrency:"BRL",price:(v.precoCentavos/100).toFixed(2),itemCondition:"https://schema.org/NewCondition",
        availability:`https://schema.org/${regras.disponibilidadeSchema({...p,...v})}`,
      })),
    } : undefined,
  };

  return (
    <div className="container-loja py-8 ap-produto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g,"\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: urlDaLoja(t) },
          { "@type": "ListItem", position: 2, name: "Produtos", item: `${urlDaLoja(t)}/produtos` },
          ...(p.categoria ? [{ "@type": "ListItem", position: 3, name: p.categoria.nome, item: `${urlDaLoja(t)}/categoria/${p.categoria.slug}` }] : []),
          { "@type": "ListItem", position: p.categoria ? 4 : 3, name: p.nome, item: `${urlDaLoja(t)}/produtos/${p.slug}` },
        ],
      }) }} />
      {ehMedicamento(medicamento) && (
        // `Drug` é o tipo que descreve medicamento em schema.org; o `Product`
        // acima continua sendo o que o Google lê para o rich result de produto.
        // Nada aqui é inventado: sai do que o lojista cadastrou.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Drug",
          name: p.nome,
          ...(medicamento.principioAtivo ? { activeIngredient: medicamento.principioAtivo, nonProprietaryName: medicamento.principioAtivo } : {}),
          ...(medicamento.apresentacao ? { dosageForm: medicamento.apresentacao } : {}),
          ...(p.marca ? { manufacturer: { "@type": "Organization", name: p.marca } } : {}),
          prescriptionStatus: exigeReceita(medicamento.tarja)
            ? "https://schema.org/PrescriptionOnly"
            : "https://schema.org/OTC",
          ...(medicamento.tipo === "generico" ? { isProprietary: false } : medicamento.tipo === "referencia" ? { isProprietary: true } : {}),
        }).replace(/</g,"\\u003c") }} />
      )}
      <EventoVerProduto item={{ id: p.id, nome: p.nome, precoCentavos: p.precoCentavos, categoria: p.categoria?.nome ?? null }} />
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/">Início</Link> / <Link href="/produtos">Produtos</Link>
        {p.categoria && (
          <>
            {" "}/ <Link href={`/categoria/${p.categoria.slug}`}>{p.categoria.nome}</Link>
          </>
        )}
      </nav>

      <div className="grid items-start gap-8 md:grid-cols-2 ap-produto-grade">
        {temaDo(t).layout === "automotivo-premium" ? <GaleriaPremium imagens={p.imagens} alt={p.nome} origem={p.imagemOrigem}/> : <GaleriaProduto imagens={p.imagens} alt={p.nome} origem={p.imagemOrigem} />}

        <div className="ap-produto-info">
          {p.marca && <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.marca}</p>}
          <h1 className="mt-1 text-2xl font-bold">{p.nome}</h1>
          {p.descricaoCurta && <p className="mt-2 text-sm text-muted-foreground">{p.descricaoCurta}</p>}

          {p.opcoes.length > 0 ? (
            <div className="mt-5 max-w-sm">
              {p.precoDeCentavos && p.precoDeCentavos > p.precoCentavos && <p className="text-sm text-muted-foreground line-through">{formatarBRL(p.precoDeCentavos)}</p>}
              <SeletorVariante
                key={escolhida?.id??p.id}
                varianteInicial={escolhida?.id}
                produto={{ id: p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] }}
                opcoes={p.opcoes}
                variantes={ofertas.filter(v=>!v.padrao).map((v) => ({ id: v.id, nome: v.nome, valores: v.valores as Record<string, string>, precoCentavos: v.precoCentavos, estoque: v.estoque, imagem: v.imagem, disponivel:v.compravel }))}
                vende={vende && !somenteNaLoja}
              />
            </div>
          ) : (
          <div className="mt-5">
            {p.precoDeCentavos && p.precoDeCentavos > p.precoCentavos && <p className="text-sm text-muted-foreground line-through">{formatarBRL(p.precoDeCentavos)}</p>}
            {sobConsulta ? (
              <>
                <p className="text-2xl font-bold text-muted-foreground">Preço sob consulta</p>
                {!estado.esgotado && <p className="text-xs text-muted-foreground">Fale com a loja para receber o preço e o prazo deste item.</p>}
              </>
            ) : (
              <>
                <p className="text-3xl font-bold">{formatarBRL(p.precoCentavos)}</p>
                {vende && t.meiosPagamento.includes("pix") && <p className="text-xs text-muted-foreground">no PIX, cartão ou boleto</p>}
              </>
            )}
            <p className={`produto-estoque mt-2 text-sm font-medium${estado.esgotado ? " text-muted-foreground" : " esta-disponivel"}`}>{estado.disponibilidade}</p>
          </div>
          )}

          <div className="mt-6 max-w-sm">
            {somenteNaLoja ? (
              // Nem carrinho nem WhatsApp: o que a RDC 44/2009 veda é a venda a
              // distância, e o pedido por mensagem seria a mesma infração por
              // outro meio. O que a loja pode oferecer é o endereço dela.
              <p className="medicamento-presencial">
                Este medicamento é dispensado <strong>somente presencialmente</strong>, mediante
                receita retida. Consulte a disponibilidade com a loja antes de ir.
              </p>
            ) : p.opcoes.length > 0 ? null : estado.acao === "aviso-reposicao" ? (
              <AvisoEstoque produtoId={p.id} />
            ) : estado.acao === "consulta-preco" ? (
              t.whatsapp ? (
                <a className="btn-primario acao-whatsapp w-full" href={linkWhatsApp(t.whatsapp, mensagemDoProduto(p, urlDaLoja(t), true))} target="_blank" rel="noopener">
                  Consultar preço
                </a>
              ) : null
            ) : estado.acao === "carrinho" ? (
              <AddToCartButton item={{ id: escolhida?`${p.id}:${escolhida.id}`:p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] }} disponivel irParaCarrinho />
            ) : t.whatsapp ? (
              <a className="btn-primario acao-whatsapp w-full" href={linkWhatsApp(t.whatsapp, mensagemDoProduto(p, urlDaLoja(t)))} target="_blank" rel="noopener">
                Pedir pelo WhatsApp
              </a>
            ) : null}
          </div>

          {p.opcoes.length === 0 && !estado.esgotado && (
            <div className="mt-4"><EstoqueBaixo estoque={p.estoque} limite={t.estoqueBaixoEm} /></div>
          )}

          <Medicamento produto={p} precoCentavos={p.precoCentavos} equivalentes={equivalentes} />

          <Compatibilidade compatibilidade={p.compatibilidade} codigoOriginal={p.codigoOriginal} codigosEquivalentes={p.codigosEquivalentes} moto={moto} />

          <ul className="mt-6 space-y-1 text-sm text-muted-foreground">
            {retiradaPublicaDisponivel(t) && <li>✔ Retirada na loja sem custo</li>}
            <li>✔ {t.despachoDiasUteis === 0
              ? "Despacho no mesmo dia útil para pagamentos confirmados durante o expediente"
              : `Envio em até ${t.despachoDiasUteis} ${t.despachoDiasUteis === 1 ? "dia útil" : "dias úteis"} após o pagamento`}</li>
            {t.freteGratisAcima != null && <li>✔ Frete grátis acima de {formatarBRL(t.freteGratisAcima)}</li>}
            {codigoPublico(p.sku) && <li className="text-xs">{rotuloDoCodigo(p.sku, p.gtin)} {codigoPublico(p.sku)}</li>}
          </ul>
          <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Informações de entrega e troca">
            <Link className="underline underline-offset-4" href="/politicas/envio">Entrega e frete</Link>
            <Link className="underline underline-offset-4" href="/politicas/devolucao">Trocas e devoluções</Link>
          </nav>

          <FichaTecnica
            atributos={(p.atributos as Record<string, unknown>) ?? {}}
            definicoes={lerDefinicoes(t.camposPersonalizados)}
            valores={lerValores(p.camposPersonalizados)}
          />
          {p.descricao && (
            <section className="prosa mt-8 text-sm leading-relaxed">
              <h2 className="mb-2 text-base font-bold">Descrição</h2>
              {p.descricao.split(/\n{2,}/).map((par, i) => (
                <p key={i}>{par}</p>
              ))}
            </section>
          )}
        </div>
      </div>

      <Avaliacoes
        produtoId={p.id}
        avaliacoes={avaliacoes.map((a) => ({ id: a.id, nome: a.nome, nota: a.nota, texto: a.texto, criadoEm: a.criadoEm.toISOString() }))}
        media={resumo.media}
        total={resumo.total}
      />

      {serie.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-1 text-base font-bold">Outras medidas desta série</h2>
          {/* A ressalva importa: mesma construção não é mesma peça, e quem
              erra a medida devolve. */}
          <p className="mb-4 text-xs text-muted-foreground">Mesma construção, dimensões diferentes. Confira a medida antes de pedir.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {serie.map((r) => <ProductCard loja={t} key={r.id} produto={r} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
          </div>
        </section>
      ) : relacionados.length > 0 ? (
        <section className="mt-12">
          {/* "Você também pode gostar" é frase de loja de roupa e não diz o que
              a lista é. Numa loja de peça, o que ela é: o resto da prateleira. */}
          <h2 className="mb-4 text-base font-bold">{p.categoria ? `Mais em ${p.categoria.nome}` : "Outros itens da loja"}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relacionados.map((r) => <ProductCard loja={t} key={r.id} produto={r} vende={vende} whatsapp={t.whatsapp} moto={moto} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
