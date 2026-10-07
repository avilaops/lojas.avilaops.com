import Link from "next/link";
import { Store, UserRound } from "lucide-react";
import type { TenantPublico } from "@/lib/tenant";
import CartButton from "@/components/cart/CartButton";
import BuscaLoja from "@/components/BuscaLoja";
import MenuMobile from "@/components/MenuMobile";

/**
 * Quantas categorias entram na barra e nos atalhos com foto.
 *
 * O mesmo número nos dois lugares, de propósito: eram duas listas diferentes na
 * mesma tela, a de texto com todas as 50 e a de foto com oito. Fica aqui porque
 * é a barra que define quantas cabem sem virar rolagem infinita.
 */
export const PRINCIPAIS = 8;

export default function Header({ loja, logoUrl, categorias, exemploBusca, mostrarPromocoes = false, mostrarNome = true }: { loja: TenantPublico; logoUrl: string | null; categorias: Array<{ slug: string; nome: string }>; exemploBusca?: string | null; mostrarPromocoes?: boolean; mostrarNome?: boolean }) {
  return (
    <header className="cabecalho-loja sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container-loja flex h-[72px] items-center gap-4">
        <Link href="/" className="marca-loja flex items-center gap-2.5 font-bold" aria-label={loja.nome}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <><img src={logoUrl} alt="" className="h-11 w-auto sm:h-12" />{mostrarNome && <span className="marca-loja-nome">{loja.nome}</span>}</>
          ) : (
            <><span className="marca-loja-icone"><Store className="h-4 w-4" /></span><span className="text-lg tracking-tight">{loja.nome}</span></>
          )}
        </Link>

        <BuscaLoja exemplo={exemploBusca} />

        {/* A lupa era o único caminho para a busca no celular. Agora o campo de
            busca está na própria barra, e manter as duas colocaria dois ícones
            de lupa lado a lado querendo dizer coisas diferentes. */}
        {/* O rótulo "Minha conta" não cabe ao lado do carrinho no celular, mas
            `hidden sm:inline-flex` tirava o link inteiro sem pôr nada no lugar:
            abaixo de 640px não havia como entrar na conta nem ver pedidos, a
            não ser digitando /conta na barra de endereço. O que não cabe é a
            palavra — o caminho tem de caber sempre. */}
        {loja.vende && (
          <Link href="/conta" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-sm font-medium sm:px-3" aria-label="Minha conta">
            <UserRound size={18} aria-hidden="true" className="sm:hidden" />
            <span className="hidden sm:inline">Minha conta</span>
          </Link>
        )}
        <MenuMobile className="ml-auto sm:hidden" nome={loja.nome} vende={loja.vende} mostrarPromocoes={mostrarPromocoes} categorias={categorias} />
        {loja.vende && <CartButton />}
      </div>

      {/* A barra mostra as principais, não o catálogo de categorias inteiro.
          Na Vedashow eram 50 numa tira que rolava de lado sem fim, com barra de
          rolagem cinza à mostra, repetindo o que os atalhos com foto já dizem.
          As duas listas passaram a sair da mesma ordem (maiores primeiro), e
          quem procura o resto tem "Ver todas". */}
      {/* A tira rola só de lado. `overflow-x: auto` sozinho também libera a
          rolagem vertical da caixa, e o sublinhado dos links ficava 10px abaixo
          dela: no iPhone a tira "escorregava" para cima com o gesto e aparecia
          num lugar diferente a cada carga. A altura agora é dos próprios links
          (44px de toque), o sublinhado fica dentro da caixa e a rolagem
          vertical está travada; `overscroll-x-contain` impede o gesto de
          arrastar a página junto quando a tira chega ao fim. */}
      {categorias.length > 0 && (
        <nav className="nav-loja border-t border-border">
          <div className="container-loja nav-loja-tira flex gap-6 overflow-x-auto overflow-y-hidden overscroll-x-contain text-[13px]">
            <Link href="/produtos" className="nav-loja-item font-semibold text-foreground">
              Todos
            </Link>
            {mostrarPromocoes && <Link href="/promocoes" className="nav-loja-item font-semibold text-primary">Promoções</Link>}
            {categorias.slice(0, PRINCIPAIS).map((c) => (
              <Link key={c.slug} href={`/categoria/${c.slug}`} className="nav-loja-item text-muted-foreground hover:text-foreground">
                {c.nome}
              </Link>
            ))}
            {categorias.length > PRINCIPAIS && (
              <Link href="/produtos" className="nav-loja-item font-medium text-primary">
                Ver todas
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
