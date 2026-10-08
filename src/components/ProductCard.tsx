import { fichaDoProduto } from "@/lib/ficha";
import { codigoPublico, rotuloDoCodigo } from "@/lib/codigo-publico";
import Link from "next/link";
import * as regras from "@/lib/produto-regras";
import type { Produto, Tenant } from "@prisma/client";
import { formatarBRL, medidaResumida } from "@/lib/catalogo";
import { avisoDaImagem, seloDaImagem } from "@/lib/imagem-origem";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { encaixe, lerCompatibilidade, type Moto } from "@/lib/motos";
import { exigeReceita, lerMedicamento, vendaRemotaProibida } from "@/lib/farmacia";
import { marcaConfirmada } from "@/lib/marca-confirmada";
import { temaDo, urlDaLoja } from "@/lib/tenant";
import { mensagemDoProduto } from "@/lib/whatsapp-produto";
import FotoDoCartao from "@/components/FotoDoCartao";

const ROTULOS_COMPACTOS: Record<string, string> = {
  diametroInternoMm: "DI", diametroExternoMm: "DE", alturaMm: "Alt.",
  medidaEixoMm: "Eixo", larguraMm: "Larg.", comprimentoMm: "Comp.",
  espessuraMm: "Esp.", secaoMm: "Seção",
};

export default function ProductCard({ produto, loja, vende, whatsapp, moto = null, ocultarSeloDestaque = false, compacto = false, alternarImagem = true }: { produto: Produto; loja: Tenant; vende: boolean; whatsapp: string | null; moto?: Moto | null; ocultarSeloDestaque?: boolean; compacto?: boolean; alternarImagem?: boolean }) {
  const tecnico = ["distribuidora", "industrial"].includes(temaDo(loja).layout);
  const serve = moto != null && encaixe(produto.compatibilidade, moto) === "serve";
  const modelos = lerCompatibilidade(produto.compatibilidade);
  const imagem = produto.imagens[0];
  const segundaImagem = alternarImagem && !tecnico ? produto.imagens[1] : undefined;
  const ficha = fichaDoProduto(produto.atributos as Record<string, unknown> | null);
  // Catálogo técnico decide pela medida e pelo material cadastrado; a
  // referência do ERP fica na página do produto, não disputa espaço no card.
  const tecnicos = ficha.filter(l => l.unidade === "mm" || (tecnico ? ["perfil", "material"] : ["referencia", "perfil", "material"]).includes(l.chave)).slice(0, 5);
  const marca = marcaConfirmada(produto.marca);
  const codigo = codigoPublico(produto.sku);
  const rotuloCodigo = rotuloDoCodigo(produto.sku, produto.gtin);
  const miniatura = imagem && /\/uploads\//.test(imagem) && !/\.svg$/i.test(imagem) ? `${imagem}?w=480` : imagem;
  const miniatura2 = segundaImagem && /\/uploads\//.test(segundaImagem) && !/\.svg$/i.test(segundaImagem) ? `${segundaImagem}?w=480` : segundaImagem;
  // Preço zero é "ainda não precificado", não "de graça". Catálogo importado
  // de ERP traz item de referência sem preço, e mostrar "R$ 0,00" com botão de
  // comprar faz a loja parecer quebrada — ou pior, promete o que não existe.
  // As regras moram em produto-regras: o card, a página e o feed respondem
  // a mesma coisa para o mesmo produto.
  const sobConsulta = regras.sobConsulta(produto);
  const disponivel = regras.compravel(produto);
  // Selo, linha de disponibilidade e botão saem da mesma resposta que a
  // página do produto e a busca usam: nenhum card pode dizer "Esgotado" e
  // oferecer pedido ao mesmo tempo.
  const estado = regras.estadoDeVenda(produto, { vende });
  const esgotado = estado.esgotado;
  const estoqueBaixo = regras.estoqueBaixo(produto);
  // Farmácia: a tarja decide se o item pode sair pela internet. Medicamento sob
  // controle especial continua na vitrine — quem procura tem que achar e ver o
  // preço — mas sem botão de comprar, porque a RDC 44/2009 proíbe a dispensação
  // a distância dele, não a sua exibição. Ver src/lib/farmacia.ts.
  const medicamento = lerMedicamento(produto);
  const somenteNaLoja = vendaRemotaProibida(medicamento.tarja);
  const pedeReceita = exigeReceita(medicamento.tarja);

  // O que a foto é. Em catálogo técnico a mesma imagem cobre uma série
  // inteira (ver docs/VEDASHOW-FOTOS.md); sem dizer isso na grade, dez itens
  // diferentes aparecem como dez fotos iguais e a economia de fotografia vira
  // devolução. A regra mora em imagem-origem.ts, com a galeria.
  const seloImagem = seloDaImagem(produto.imagemOrigem, !!imagem);
  const avisoImagem = avisoDaImagem(produto.imagemOrigem, !!imagem);
  // A medida com que a peça é pedida no balcão, quando o cadastro tem.
  const medida = medidaResumida(produto.atributos);

  const percentualDesconto =
    produto.precoDeCentavos && produto.precoDeCentavos > produto.precoCentavos
      ? Math.round(((produto.precoDeCentavos - produto.precoCentavos) / produto.precoDeCentavos) * 100)
      : null;

  return (
    <article className={`cartao-produto${tecnico ? " cartao-produto-tecnico" : ""} group flex flex-col overflow-hidden rounded-xl border border-border bg-card`}>
      <Link href={`/produtos/${produto.slug}`} className={`cartao-produto-imagem relative block overflow-hidden bg-muted${imagem ? " aspect-square" : " cartao-produto-sem-imagem"}`}>
        {imagem ? (
          <>
            {/* Imagem Principal */}
            <FotoDoCartao
              src={miniatura}
              alt={produto.nome}
              loading="lazy"
              className={`h-full w-full object-contain transition-all duration-500 ${
                segundaImagem ? "group-hover:opacity-0 group-hover:scale-105" : "group-hover:scale-105"
              }`}
            />
            {/* Segunda Imagem no Hover (Hover Reveal) */}
            {segundaImagem && (
              <FotoDoCartao
                src={miniatura2}
                alt={`${produto.nome} - ângulo secundário`}
                loading="lazy"
                secundaria
                className="absolute inset-0 h-full w-full object-contain opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
              />
            )}
          </>
        ) : (
          <div className="produto-sem-foto flex h-full items-center justify-center text-xs text-muted-foreground">Sem foto do produto</div>
        )}

        {/* Badges Flutuantes */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1 z-10">
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

        {seloImagem && (
          // Embaixo e discreto: é ressalva, não chamada. As tarjas de preço e
          // estoque ficam no topo e continuam mandando na atenção.
          <span
            className="absolute bottom-2 left-2 z-10 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
            title={avisoImagem ?? undefined}
          >
            {seloImagem}
          </span>
        )}
      </Link>
      <div className="cartao-produto-conteudo flex flex-1 flex-col gap-2 p-4">
        {!tecnico && marca && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{marca}</p>}
        {serve ? (
          <p className="selo-serve">✔ Serve na sua moto</p>
        ) : modelos.length > 0 ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground" title={modelos.map((c) => `${c.marca} ${c.modelo}`).join(", ")}>
            {modelos.slice(0, 2).map((c) => c.modelo).join(" · ")}{modelos.length > 2 ? ` +${modelos.length - 2}` : ""}
          </p>
        ) : null}
        <Link href={`/produtos/${produto.slug}`} className="cartao-produto-nome text-sm font-semibold hover:text-primary transition-colors">
          {produto.nome}
        </Link>
        {/* A medida do balcão fica fora do modo técnico: lá o `dl` compacto
            abaixo já diz as mesmas medidas, com rótulo abreviado e feito para
            aquele layout — as duas juntas seriam a mesma medida duas vezes. */}
        {!tecnico && medida && (
          <p className="w-fit rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground" title="Medida cadastrada deste item">
            {medida}
          </p>
        )}
        {!tecnico && codigo && <p className="text-xs text-muted-foreground break-words">{rotuloCodigo}: {codigo}</p>}
        {tecnicos.length > 0 && <dl className="cartao-produto-tecnica">{tecnicos.map(l => <div key={l.chave}><dt>{tecnico && ROTULOS_COMPACTOS[l.chave] ? <abbr title={l.rotulo}>{ROTULOS_COMPACTOS[l.chave]}</abbr> : l.rotulo}</dt><dd>{l.valor}</dd></div>)}</dl>}
        {tecnico && <p className="cartao-produto-identificacao">{marca && <span>{marca}</span>}{codigo && <span>{rotuloCodigo}: {codigo}</span>}</p>}
        <div className={tecnico ? "cartao-produto-disponibilidade" : "contents"}>
          <p className={`cartao-produto-estoque text-xs ${esgotado ? "text-muted-foreground" : "esta-disponivel"}`}>{estado.disponibilidade}</p>
          <Link href={`/produtos/${produto.slug}`} className="text-xs underline underline-offset-4">Ver detalhes</Link>
        </div>
        <div className="cartao-produto-preco mt-auto pt-1">
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
        ) : estado.acao === "aviso-reposicao" ? (
          <Link href={`/produtos/${produto.slug}`} className="btn-secundario w-full text-xs">Ver disponibilidade</Link>
        ) : estado.acao === "consulta-preco" ? (
          // Sem preço não há carrinho: o caminho é falar com a loja. É assim
          // que peça de catálogo técnico é comprada mesmo quando tem preço.
          whatsapp ? (
            <a className="btn-primario acao-whatsapp w-full text-xs" href={linkWhatsApp(whatsapp, mensagemDoProduto(produto, urlDaLoja(loja), true))} target="_blank" rel="noopener">
              Consultar preço
            </a>
          ) : (
            <Link href={`/produtos/${produto.slug}`} className="btn-secundario w-full text-xs">
              Ver detalhes
            </Link>
          )
        ) : estado.acao === "carrinho" && produto.opcoes.length > 0 ? (
          <Link href={`/produtos/${produto.slug}`} className="btn-secundario w-full text-xs">
            Ver opções
          </Link>
        ) : estado.acao === "carrinho" ? (
          <AddToCartButton
            compacto={compacto}
            item={{ id: produto.id, slug: produto.slug, nome: produto.nome, precoCentavos: produto.precoCentavos, imagem }}
            disponivel={disponivel}
          />
        ) : whatsapp ? (
          <a className="btn-primario acao-whatsapp w-full text-xs" href={linkWhatsApp(whatsapp, mensagemDoProduto(produto, urlDaLoja(loja)))} target="_blank" rel="noopener">
            Pedir pelo WhatsApp
          </a>
        ) : null}
      </div>
    </article>
  );
}
