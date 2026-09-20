import Link from "next/link";
import * as regras from "@/lib/produto-regras";
import type { Produto } from "@prisma/client";
import { formatarBRL } from "@/lib/catalogo";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { encaixe, lerCompatibilidade, type Moto } from "@/lib/motos";
import { exigeReceita, lerMedicamento, vendaRemotaProibida } from "@/lib/farmacia";
import { marcaConfirmada } from "@/lib/marca-confirmada";

export default function ProductCard({ produto, vende, whatsapp, moto = null, ocultarSeloDestaque = false }: { produto: Produto; vende: boolean; whatsapp: string | null; moto?: Moto | null; ocultarSeloDestaque?: boolean }) {
  const serve = moto != null && encaixe(produto.compatibilidade, moto) === "serve";
  const modelos = lerCompatibilidade(produto.compatibilidade);
  const imagem = produto.imagens[0];
  const segundaImagem = produto.imagens[1];\n  const marca = marcaConfirmada(produto.marca);
  const miniatura = imagem && /\/uploads\//.test(imagem) && !/\.svg$/i.test(imagem) ? `${imagem}?w=480` : imagem;
  const miniatura2 = segundaImagem && /\/uploads\//.test(segundaImagem) && !/\.svg$/i.test(segundaImagem) ? `${segundaImagem}?w=480` : segundaImagem;
  // Preço zero é "ainda não precificado", não "de graça". Catálogo importado
  // de ERP traz item de referência sem preço, e mostrar "R$ 0,00" com botão de
  // comprar faz a loja parecer quebrada — ou pior, promete o que não existe.
  // As regras moram em produto-regras: o card, a página e o feed respondem
  // a mesma coisa para o mesmo produto.
  const sobConsulta = regras.sobConsulta(produto);
  const disponivel = regras.compravel(produto);
  const esgotado = regras.esgotado(produto);
  const estoqueBaixo = regras.estoqueBaixo(produto);
  // Farmácia: a tarja decide se o item pode sair pela internet. Medicamento sob
  // controle especial continua na vitrine — quem procura tem que achar e ver o
  // preço — mas sem botão de comprar, porque a RDC 44/2009 proíbe a dispensação
  // a distância dele, não a sua exibição. Ver src/lib/farmacia.ts.
  const medicamento = lerMedicamento(produto);
  const somenteNaLoja = vendaRemotaProibida(medicamento.tarja);
  const pedeReceita = exigeReceita(medicamento.tarja);

  const percentualDesconto =
    produto.precoDeCentavos && produto.precoDeCentavos > produto.precoCentavos
      ? Math.round(((produto.precoDeCentavos - produto.precoCentavos) / produto.precoDeCentavos) * 100)
      : null;

  return (
    <article className="cartao-produto group flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Link href={`/produtos/${produto.slug}`} className="cartao-produto-imagem relative block aspect-square overflow-hidden bg-muted">
        {imagem ? (
          <>
            {/* Imagem Principal */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={miniatura}
              alt={produto.nome}
              loading="lazy"
              className={`h-full w-full object-cover transition-all duration-500 ${
                segundaImagem ? "group-hover:opacity-0 group-hover:scale-105" : "group-hover:scale-105"
              }`}
            />
            {/* Segunda Imagem no Hover (Hover Reveal) */}
            {segundaImagem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={miniatura2}
                alt={`${produto.nome} - ângulo secundário`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
              />
            )}
          </>
        ) : (
          <div className="produto-sem-foto flex h-full items-center justify-center text-xs text-muted-foreground">Imagem em preparação</div>
        )}

        {/* Badges Flutuantes */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1 z-10">
          {produto.imagemOrigem === "representativa" && (
            <span className="rounded-md bg-zinc-900/90 px-2 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
              Imagem representativa
            </span>
          )}
          {produto.imagemOrigem === "ilustracao" && (
            <span className="rounded-md bg-zinc-900/90 px-2 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
              Ilustração técnica
            </span>
          )}
          {percentualDesconto && (
            <span className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase text-white shadow-sm">
              -{percentualDesconto}% OFF
            </span>
          )}
          {produto.destaque && !ocultarSeloDestaque && (
            <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
              Destaque
            </span>
          )}
          {estoqueBaixo && (
            <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              Últimas {produto.estoque} un.
            </span>
          )}
          {esgotado && (
            <span className="rounded-md bg-zinc-800/90 px-2 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur-sm shadow-sm">
              Esgotado
            </span>
          )}
          {somenteNaLoja ? (
            <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              Só na loja física
            </span>
          ) : pedeReceita ? (
            <span className="rounded-md bg-red-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              Receita
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {marca && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{marca}</p>}
        {serve ? (
          <p className="selo-serve">✔ Serve na sua moto</p>
        ) : modelos.length > 0 ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground" title={modelos.map((c) => `${c.marca} ${c.modelo}`).join(", ")}>
            {modelos.slice(0, 2).map((c) => c.modelo).join(" · ")}{modelos.length > 2 ? ` +${modelos.length - 2}` : ""}
          </p>
        ) : null}
        <Link href={`/produtos/${produto.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-primary transition-colors">
          {produto.nome}
        </Link>
        <div className="mt-auto pt-1">
          {produto.precoDeCentavos && produto.precoDeCentavos > produto.precoCentavos && (
            <p className="text-xs text-muted-foreground line-through">{formatarBRL(produto.precoDeCentavos)}</p>
          )}
          {sobConsulta ? (
            <p className="text-base font-bold tracking-tight text-muted-foreground">Preço sob consulta</p>
          ) : (
            <p className="text-xl font-black tracking-tight text-foreground">{formatarBRL(produto.precoCentavos)}</p>
          )}
        </div>
        {somenteNaLoja ? (
          // Sem carrinho e sem WhatsApp: o que a norma veda é a venda a
          // distância, e oferecer o pedido por mensagem seria a mesma infração
          // por outro meio. O caminho é a página, que explica, e a loja física.
          <Link href={`/produtos/${produto.slug}`} className="btn-secundario w-full text-xs">
            Ver informações
          </Link>
        ) : sobConsulta ? (
          // Sem preço não há carrinho: o caminho é falar com a loja. É assim
          // que peça de catálogo técnico é comprada mesmo quando tem preço.
          whatsapp ? (
            <a className="btn-primario w-full text-xs" href={linkWhatsApp(whatsapp, `Olá! Quero saber o preço de: ${produto.nome}`)} target="_blank" rel="noopener">
              Consultar preço
            </a>
          ) : (
            <Link href={`/produtos/${produto.slug}`} className="btn-secundario w-full text-xs">
              Ver detalhes
            </Link>
          )
        ) : vende && produto.opcoes.length > 0 ? (
          <Link href={`/produtos/${produto.slug}`} className="btn-secundario w-full text-xs">
            Ver opções
          </Link>
        ) : vende ? (
          <AddToCartButton
            item={{ id: produto.id, slug: produto.slug, nome: produto.nome, precoCentavos: produto.precoCentavos, imagem }}
            disponivel={disponivel}
          />
        ) : whatsapp ? (
          <a className="btn-primario w-full text-xs" href={linkWhatsApp(whatsapp, `Olá! Tenho interesse em: ${produto.nome}`)} target="_blank" rel="noopener">
            Pedir pelo WhatsApp
          </a>
        ) : null}
      </div>
    </article>
  );
}
