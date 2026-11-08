import Link from "next/link";
import { ofertaMerchant, imagensMerchant } from "@/lib/merchant-schema";
import { codigoPublico, rotuloDoCodigo } from "@/lib/codigo-publico";
import { notFound, permanentRedirect } from "next/navigation";
import FichaTecnica from "@/components/FichaTecnica";
import ReferenciasAgelPk from "@/components/ReferenciasAgelPk";
import { DesenhoTecnico } from "@/components/pk/DesenhoTecnico";
import { BeneficiosProduto } from "@/components/pk/BeneficiosProduto";
import { CompararProduto } from "@/components/pk/CompararProduto";
import { lerDefinicoes, lerValores } from "@/lib/campos-personalizados";
import { exigirTenant, lojaVende, urlDaLoja, temaDo, retiradaPublicaDisponivel } from "@/lib/tenant";
import GaleriaPremium from "@/components/templates/automotivo-premium/Galeria";
import { buscarProduto, equivalentesDoProduto, formatarBRL, listarProdutos, mesmaSerie, resumoAvaliacoes } from "@/lib/catalogo";
import { destinoDoProdutoArquivado } from "@/lib/catalogo-redirecionamento";
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
import TabelaTecnica from "@/components/TabelaTecnica";
import { listaEmTabela } from "@/lib/templates";
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
import { midiasDaOferta, usaImagensPorVolume } from "@/lib/catalogo-qualidade";
import { paragrafosDaDescricao } from "@/lib/descricao-produto";
import { marcaConfirmada } from "@/lib/marca-confirmada";
import { envioSchema } from "@/lib/envio-declarado";
import { usaBlocoProprio } from "@/lib/templates";
import { LinkContatoMedido } from "@/components/EventoFunil";
import { retornoSeguroDoCatalogo } from "@/lib/retorno-catalogo";
import { referenciaPoliticaDevolucao } from "@/lib/politicas";
import { numeroDeContato } from "@/lib/canais-publicos";
import ConsultarEntrega from "@/components/checkout/ConsultarEntrega";
import { localPublicoDeRetirada } from "@/lib/retirada-publica";
import { prazoDeDespacho } from "@/lib/textos-loja";
import ResumoProdutoDomiRio from "@/components/domirio/ResumoProduto";
import CotacaoProdutoDomiRio from "@/components/domirio/CotacaoProduto";

const MEIOS: Record<string, string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto" };

type Props = { params: Promise<{ slug: string }>; searchParams:Promise<{variante?:string;voltar?:string}> };

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
  const whatsapp = numeroDeContato(t.whatsapp);
  const { slug } = await params;
  const p = await buscarProduto(t.id, slug);
  if (!p) {
    const destino = await destinoDoProdutoArquivado(t.id, slug);
    if (destino) permanentRedirect(destino);
    notFound();
  }
  // A categoria pode ser desativada sem desativar os produtos que ainda
  // pertencem a ela. O produto continua consultável, mas não aponta para uma
  // categoria pública que responde 404.
  if (p.categoria && !p.categoria.ativo) p.categoria = null;
  const {variante:varianteId,voltar}=await searchParams;
  const retorno = retornoSeguroDoCatalogo(voltar);
  const ofertas=p.variantes.filter(v=>v.ativo).map(ofertaDaVariante);
  // A apresentação padrão normalmente representa o produto simples e não tem
  // valores de grade. Quando ela os declara, é uma apresentação comprável da
  // grade — por exemplo, 100 mL ao lado de 35 mL e 1 L — e precisa aparecer.
  const variacoesVisiveis = ofertas.filter((v) => !v.padrao || p.opcoes.every((opcao) => {
    const valor = (v.valores as Record<string, unknown>)[opcao];
    return typeof valor === "string" && Boolean(valor.trim());
  }));
  const escolhida=ofertas.find(v=>v.id===varianteId)??ofertas.find(v=>v.padrao);
  if(varianteId&&!ofertas.some(v=>v.id===varianteId))notFound();
  const volume = usaImagensPorVolume(p) && escolhida
    ? (escolhida.valores as Record<string, unknown> | null)?.Volume
    : undefined;
  const titulo = typeof volume === "string" && volume ? `${p.nome} ${volume}` : p.nome;
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
  const meiosDaLoja = t.meiosPagamento.map((m) => MEIOS[m]).filter(Boolean).join(" · ");
  // "Consultar preço" e "Pedir pelo WhatsApp" já são a conversa; nos outros
  // casos (carrinho, aviso de reposição, variantes) o link entra.
  const duvidaNoWhatsApp = !somenteNaLoja && (p.opcoes.length > 0 || estado.acao === "carrinho" || estado.acao === "aviso-reposicao");
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
  const politicaDevolucao = referenciaPoliticaDevolucao(`${urlDaLoja(t)}/politicas/devolucao`);

  const base = urlDaLoja(t);
  const pagina = `${base}/produtos/${p.slug}`;
  const imagens = imagensMerchant(p.imagens, base);
  const montarOferta = (oferta: Parameters<typeof ofertaMerchant>[0], url: string) => {
    const schema = ofertaMerchant(oferta, url, `${base}/#organization`, politicaDevolucao, somenteNaLoja);
    if (!schema) return undefined;
    const envio = !somenteNaLoja ? envioSchema(t, oferta.precoCentavos) : undefined;
    return { ...schema, ...(envio ? { shippingDetails: envio } : {}) };
  };
  const ofertasSchema = escolhida
    ? montarOferta(p, `${pagina}${!escolhida.padrao ? `?variante=${encodeURIComponent(escolhida.id)}` : ""}`)
    : p.opcoes.length === 0
      ? montarOferta(p, pagina)
      : ofertas.filter(v => v.precoCentavos > 0).map(v =>
          montarOferta(v, `${pagina}?variante=${encodeURIComponent(v.id)}`),
        ).filter(v => v !== undefined);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: titulo,
    ...(marcaConfirmada(p.marca) ? { brand: { "@type": "Brand", name: marcaConfirmada(p.marca)! } } : {}),
    ...(p.sku && !/\s/u.test(p.sku) ? { sku: p.sku } : {}),
    ...(gtinValido(p.gtin) ? { gtin: p.gtin } : {}),
    ...(escolhida?.mpn ? { mpn: escolhida.mpn } : {}),
    ...(compat.length ? { isAccessoryOrSparePartFor: compat.map((c) => ({ "@type": "Vehicle", name: `${c.marca} ${c.modelo}`, brand: { "@type": "Brand", name: c.marca }, model: c.modelo })) } : {}),
    url: `${urlDaLoja(t)}/produtos/${p.slug}`,
    image: imagens,
    // Texto puro: a descrição importada vem com HTML, e tag dentro do JSON-LD
    // aparece literal no rich result.
    description: textoPuro(p.descricaoCurta) || textoPuro(p.descricao) || undefined,
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
    offers: ofertasSchema,
  };

  return (
    <div className="container-loja py-8 ap-produto">
      {imagens.length > 0 && ofertasSchema && (!Array.isArray(ofertasSchema) || ofertasSchema.length > 0) && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g,"\\u003c") }} />
      )}
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
      <nav aria-label="Caminho do produto" className="mb-4 text-xs text-muted-foreground">
        <Link href="/">Início</Link> / <Link href="/produtos">Produtos</Link>
        {p.categoria && (
          <>
            {" "}/ <Link href={`/categoria/${p.categoria.slug}`}>{p.categoria.nome}</Link>
          </>
        )}
      </nav>
      {retorno && (
        <Link href={retorno} className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">
          ← Voltar aos resultados
        </Link>
      )}

      <div className="grid items-start gap-8 md:grid-cols-2 ap-produto-grade">
        {usaBlocoProprio(temaDo(t), "produto") ? <GaleriaPremium key={escolhida?.id} imagens={p.imagens} alt={titulo} origem={p.imagemOrigem}/> : <GaleriaProduto key={escolhida?.id} imagens={p.imagens} alt={titulo} origem={p.imagemOrigem} />}

        <div className="ap-produto-info">
          {p.marca && <p className="ap-produto-marca text-xs uppercase tracking-wide text-muted-foreground">{p.marca}</p>}
          <h1 className="mt-1 text-2xl font-bold">{titulo}</h1>
          {t.slug === "domi-rio" && <ResumoProdutoDomiRio marca={p.marca} sku={p.sku} atributos={p.atributos} apresentacao={p.opcoes.length ? (escolhida?.nome ?? "Selecione abaixo") : undefined} />}
          {p.descricaoCurta && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{textoPuro(p.descricaoCurta)}</p>}
          {t.slug === "pkvedacoes" && <div className="mt-4 space-y-4">
            <BeneficiosProduto tenantSlug={t.slug} nome={p.nome} atributos={p.atributos} />
            <CompararProduto tenantSlug={t.slug} slug={p.slug} nome={p.nome} />
            <Link className="ml-4 text-sm underline" href="/comparar">Abrir comparação</Link>
          </div>}

          {p.opcoes.length > 0 ? (
            <div className="mt-5 max-w-sm">
              {p.precoDeCentavos && p.precoDeCentavos > p.precoCentavos && <p className="text-sm text-muted-foreground line-through">{formatarBRL(p.precoDeCentavos)}</p>}
              <SeletorVariante
                key={escolhida?.id??p.id}
                varianteInicial={escolhida?.id}
                produto={{ id: p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: usaImagensPorVolume(p) ? undefined : p.imagens[0] }}
                opcoes={p.opcoes}
                variantes={variacoesVisiveis.map((v) => ({ id: v.id, nome: v.nome, valores: v.valores as Record<string, string>, precoCentavos: v.precoCentavos, estoque: v.estoque, imagem: usaImagensPorVolume(p) ? midiasDaOferta(p, v.id)[0]?.url ?? null : v.imagem, disponivel:v.compravel }))}
                vende={vende && !somenteNaLoja}
                retorno={retorno}
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
                {/* Só os meios que a loja habilitou: "PIX, cartão ou boleto" fixo
                    prometia boleto a quem aceita só Pix e cartão. */}
                {vende && meiosDaLoja && <p className="mt-1 text-sm text-muted-foreground">{meiosDaLoja}</p>}
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
              whatsapp ? (
                <LinkContatoMedido className="btn-primario acao-whatsapp w-full" href={linkWhatsApp(whatsapp, mensagemDoProduto(p, urlDaLoja(t), true))} target="_blank" rel="noopener">
                  Consultar preço
                </LinkContatoMedido>
              ) : null
            ) : estado.acao === "carrinho" ? (
              <AddToCartButton item={{ id: escolhida?`${p.id}:${escolhida.id}`:p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] }} disponivel irParaCarrinho />
            ) : whatsapp ? (
              <>
                <AddToCartButton pedido item={{ id: p.id, slug: p.slug, nome: p.nome, precoCentavos: p.precoCentavos, imagem: p.imagens[0] }} disponivel />
                <LinkContatoMedido className="btn-secundario acao-whatsapp mt-2 w-full" href={linkWhatsApp(whatsapp, mensagemDoProduto(p, urlDaLoja(t)))} target="_blank" rel="noopener">
                  Pedir só este item pelo WhatsApp
                </LinkContatoMedido>
              </>
            ) : null}
            {!somenteNaLoja && !estado.esgotado && (estado.acao === "carrinho" || Boolean(whatsapp)) && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {estado.acao === "carrinho"
                  ? "Adicione ao carrinho para informar a entrega e concluir o pagamento no site."
                  : whatsapp
                    ? "Adicione ao pedido; a loja confirma disponibilidade, entrega e pagamento pelo WhatsApp."
                    : null}
              </p>
            )}
          </div>

          {p.opcoes.length === 0 && !estado.esgotado && (
            <div className="mt-4"><EstoqueBaixo estoque={p.estoque} limite={t.estoqueBaixoEm} /></div>
          )}

          {p.opcoes.length === 0 && !somenteNaLoja && estado.acao === "carrinho" && <ConsultarEntrega itens={[{ id: escolhida ? `${p.id}:${escolhida.id}` : p.id, quantidade: 1 }]} subtotal={p.precoCentavos} whatsapp={whatsapp} localRetirada={localPublicoDeRetirada(t)} />}

          <Medicamento produto={p} precoCentavos={p.precoCentavos} equivalentes={equivalentes} />
          {t.slug === "domi-rio" && !estado.esgotado && <CotacaoProdutoDomiRio key={escolhida?.id ?? p.id} baseUrl={base} whatsapp={whatsapp}
            produto={{ nome: p.nome, slug: p.slug, sku: p.sku, apresentacao: typeof (p.atributos as Record<string, unknown> | null)?.apresentacaoComercial === "string" ? String((p.atributos as Record<string, unknown>).apresentacaoComercial) : undefined }}
            apresentacoes={p.opcoes.length ? variacoesVisiveis.filter(v => regras.emEstoque(v)).map(v => ({ id: v.id, nome: v.nome, sku: v.sku })) : []}
            varianteInicial={escolhida?.id} />}

          <Compatibilidade compatibilidade={p.compatibilidade} codigoOriginal={p.codigoOriginal} codigosEquivalentes={p.codigosEquivalentes} moto={moto} />
          <ReferenciasAgelPk tenantSlug={t.slug} produto={p} />

          <ul className="mt-6 space-y-1 text-sm text-muted-foreground">
            {retiradaPublicaDisponivel(t) && <li>✔ Retirada na loja sem custo</li>}
            <li>✔ Preparo do pedido {prazoDeDespacho(t.despachoDiasUteis)} após a confirmação do pagamento</li>
            <li>✔ Opções de entrega e prazo de transporte conforme o CEP</li>
            {t.freteGratisAcima != null && <li>✔ Frete grátis acima de {formatarBRL(t.freteGratisAcima)}</li>}
            {codigoPublico(p.sku) && <li className="text-xs">{rotuloDoCodigo(p.sku, p.gtin)} {codigoPublico(p.sku)}</li>}
          </ul>
          <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Entrega, trocas e atendimento">
            <Link className="underline underline-offset-4" href="/politicas/envio">Entrega e frete</Link>
            <Link className="underline underline-offset-4" href="/politicas/devolucao">Trocas e devoluções</Link>
            {/* O WhatsApp flutuante some na ficha (cobria o botão de compra).
                Onde a ação principal não é o WhatsApp, a dúvida sobre o produto
                precisa de outro caminho, já com o nome e o link dele. */}
            {duvidaNoWhatsApp && whatsapp && <LinkContatoMedido className="underline underline-offset-4" href={linkWhatsApp(whatsapp, `Olá! Tenho uma dúvida sobre ${p.nome}: ${urlDaLoja(t)}/produtos/${p.slug}`)} target="_blank" rel="noopener">Tirar dúvida sobre o produto</LinkContatoMedido>}
          </nav>

          <FichaTecnica
            atributos={(p.atributos as Record<string, unknown>) ?? {}}
            definicoes={lerDefinicoes(t.camposPersonalizados)}
            valores={lerValores(p.camposPersonalizados)}
          />
          <DesenhoTecnico tenantSlug={t.slug} atributos={p.atributos} />
          {p.descricao && (
            <section className="prosa mt-8 text-sm leading-relaxed">
              <h2 className="mb-2 text-base font-bold">Descrição</h2>
              {paragrafosDaDescricao(p.descricao).map((par, i) => (
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
          {listaEmTabela(temaDo(t)) ? (
            <>
              <h2 className="mb-1 text-base font-bold">Outras medidas desta série</h2>
              <p className="mb-4 text-xs text-muted-foreground">Mesma construção, dimensões diferentes. Confira a medida antes de pedir.</p>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-base font-bold">Outras apresentações</h2>
              <p className="mb-4 text-xs text-muted-foreground">Confira o volume, o peso e os demais detalhes antes de pedir.</p>
            </>
          )}
          {listaEmTabela(temaDo(t)) ? (
            <TabelaTecnica produtos={serie} vende={vende} titulo="Outras medidas desta série" nomeDaLoja={t.nome} loja={t} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {serie.map((r) => <ProductCard loja={t} key={r.id} produto={r} vende={vende} whatsapp={whatsapp} moto={moto} />)}
            </div>
          )}
        </section>
      ) : relacionados.length > 0 ? (
        <section className="mt-12">
          {/* "Você também pode gostar" é frase de loja de roupa e não diz o que
              a lista é. Numa loja de peça, o que ela é: o resto da prateleira. */}
          <h2 className="mb-4 text-base font-bold">{p.categoria ? `Mais em ${p.categoria.nome}` : "Outros itens da loja"}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relacionados.map((r) => <ProductCard loja={t} key={r.id} produto={r} vende={vende} whatsapp={whatsapp} moto={moto} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
