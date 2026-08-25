import Link from "next/link";
import type { Produto } from "@prisma/client";
import { formatarBRL } from "@/lib/catalogo";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";

export default function ProductCard({ produto, vende, whatsapp }: { produto: Produto; vende: boolean; whatsapp: string | null }) {
  const imagem = produto.imagens[0];
  const disponivel = produto.disponibilidade !== "out_of_stock";
  return (
    <article className="cartao-produto group flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Link href={`/produtos/${produto.slug}`} className="cartao-produto-imagem relative block aspect-square overflow-hidden bg-muted">
        {imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagem} alt={produto.nome} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
        ) : (
          <div className="produto-sem-foto flex h-full items-center justify-center text-xs text-muted-foreground">Imagem em preparação</div>
        )}
        {produto.destaque && <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">Destaque</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {produto.marca && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{produto.marca}</p>}
        <Link href={`/produtos/${produto.slug}`} className="line-clamp-2 text-sm font-semibold">
          {produto.nome}
        </Link>
        <div className="mt-auto">
          {produto.precoDeCentavos && produto.precoDeCentavos > produto.precoCentavos && (
            <p className="text-xs text-muted-foreground line-through">{formatarBRL(produto.precoDeCentavos)}</p>
          )}
          <p className="text-xl font-bold tracking-tight">{formatarBRL(produto.precoCentavos)}</p>
        </div>
        {vende && produto.opcoes.length > 0 ? (
          <Link href={`/produtos/${produto.slug}`} className="btn-secundario w-full">Ver opções</Link>
        ) : vende ? (
          <AddToCartButton item={{ id: produto.id, slug: produto.slug, nome: produto.nome, precoCentavos: produto.precoCentavos, imagem }} disponivel={disponivel && (produto.estoque == null || produto.estoque > 0)} />
        ) : whatsapp ? (
          <a className="btn-primario w-full" href={linkWhatsApp(whatsapp, `Olá! Tenho interesse em: ${produto.nome}`)} target="_blank" rel="noopener">
            Pedir pelo WhatsApp
          </a>
        ) : null}
      </div>
    </article>
  );
}
