import type { Produto, Tenant } from "@prisma/client";
import Link from "@/components/LinkLoja";
import { formatarBRL } from "@/lib/catalogo";
import { estadoDeVenda } from "@/lib/produto-regras";
import { ROTULOS_COLUNA, colunasVisiveis, linhaTecnica, type Coluna, type LinhaTecnica } from "@/lib/catalogo-tecnico";
import { mensagemDoProduto } from "@/lib/whatsapp-produto";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { urlDaLoja } from "@/lib/tenant";
import AddToCartButton from "@/components/cart/AddToCartButton";

function celula(linha: LinhaTecnica, coluna: Coluna) {
  if (coluna === "equivalentes") return linha.equivalentes.join(", ") || "—";
  if (coluna === "aplicacao") {
    const { texto, restantes } = linha.aplicacao;
    return restantes > 0 ? <>{texto} <span className="ct-mais">+{restantes}</span></> : texto;
  }
  return linha[coluna] ?? "—";
}

/**
 * O que a coluna de preço diz, pela mesma regra do card e da página do produto
 * (`estadoDeVenda`): esgotado vence tudo, sem preço é consulta. Preço cheio ao
 * lado de uma peça sem estoque é o comprador descobrindo no carrinho.
 */
function preco(produto: Produto, vende: boolean) {
  const estado = estadoDeVenda(produto, { vende });
  if (estado.esgotado) return <span className="ct-esgotado">Esgotado</span>;
  if (estado.acao === "consulta-preco") return "Sob consulta";
  return formatarBRL(produto.precoCentavos);
}

/**
 * Tabela de peças no lugar da grade de fotos: código, código original,
 * equivalentes, medidas e aplicação, que é o que quem compra peça confere
 * primeiro. As colunas saem do catálogo; a que a loja não usa não aparece.
 *
 * Com `loja`, cada linha ganha a ação: ver a peça quando a loja vende pelo
 * site, pedir pelo WhatsApp quando não vende. Numa série em que cem itens só
 * diferem em milímetros, a mesma foto repetida cem vezes não ajuda a escolher;
 * a linha com as medidas, sim.
 */
export default function TabelaTecnica({ produtos, vende, titulo, nomeDaLoja, loja }: { produtos: Produto[]; vende: boolean; titulo: string; nomeDaLoja: string; loja?: Tenant }) {
  const linhas = produtos.map((produto) => ({ produto, linha: linhaTecnica(produto) }));
  // Na listagem da loja, coluna que diz a mesma coisa em toda linha (a marca,
  // quando a loja é o fabricante) só empurra o preço para fora da tela.
  const marcas = new Set(linhas.map((l) => l.linha.marca ?? ""));
  const colunas = colunasVisiveis(linhas.map((l) => l.linha)).filter((c) => !(loja && c === "marca" && marcas.size <= 1));
  return (
    <div className={`ct-rolagem${loja ? " ct-listagem" : ""}`} role="region" aria-label={titulo} tabIndex={0}>
      <table className="ct-tabela">
        <caption className="sr-only">{titulo} de {nomeDaLoja}</caption>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            {colunas.map((coluna) => <th scope="col" key={coluna}>{ROTULOS_COLUNA[coluna]}</th>)}
            <th scope="col" className="ct-preco">Preço</th>
            {loja && <th scope="col" className="ct-acao"><span className="sr-only">Ação</span></th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ produto, linha }) => (
            <tr key={produto.id}>
              <th scope="row"><Link href={`/produtos/${linha.slug}`}>{linha.nome}</Link></th>
              {colunas.map((coluna) => <td key={coluna} className={`ct-${coluna}`}>{celula(linha, coluna)}</td>)}
              <td className="ct-preco">{preco(produto, vende)}</td>
              {loja && (
                <td className="ct-acao">
                  {estadoDeVenda(produto, { vende }).acao === "consulta-preco" && loja.whatsapp
                    ? <a href={linkWhatsApp(loja.whatsapp, mensagemDoProduto(produto, urlDaLoja(loja), true))} target="_blank" rel="noopener">Consultar</a>
                    : (vende || loja.whatsapp) && produto.opcoes.length === 0 && !estadoDeVenda(produto, { vende }).esgotado
                      ? <AddToCartButton compacto pedido={!vende} disponivel item={{ id: produto.id, slug: produto.slug, nome: produto.nome, precoCentavos: produto.precoCentavos, imagem: produto.imagens[0] }} />
                      : <Link href={`/produtos/${linha.slug}`}>Ver</Link>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
