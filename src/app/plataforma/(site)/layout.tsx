import Link from "next/link";
import NavegacaoPublica from "@/components/plataforma/NavegacaoPublica";
import Consentimento, { PreferenciasCookies } from "@/components/Consentimento";
import Pixels from "@/components/Pixels";
import { pixelsDaPlataforma, temRastreio } from "@/lib/pixels";
import { sessaoDoPainel } from "@/lib/sessao";
import MarcaLojas from "@/components/marca/MarcaLojas";
import "../marca-lojas.css";
import "../plataforma.css";

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoDoPainel();
  const lojista = sessao?.tenant ?? null;
  // Só no site público. O painel do lojista tem layout próprio e fica sem tag:
  // ali circulam pedido, cliente e faturamento da loja de outra pessoa.
  const pixels = pixelsDaPlataforma();
  return (
    <div className="plataforma-shell">
      <Pixels p={pixels} />
      <a href="#conteudo-principal" className="pl-pular-conteudo">Pular para o conteúdo</a>
      <header className="pl-header">
        <div className="pl-container pl-header-inner">
          <Link href="/" aria-label="Lojas por Avila Ops"><MarcaLojas /></Link>
          <NavegacaoPublica loja={lojista?.nome ?? null} equipe={sessao?.equipe === true} />
        </div>
      </header>
      <main id="conteudo-principal" tabIndex={-1}>{children}</main>
      <Consentimento ativo={temRastreio(pixels)} plataforma />
      <footer className="pl-footer">
        <div className="pl-container pl-footer-grid">
          <div><MarcaLojas /><p>Loja virtual pronta em um dia. Planos mensais + 5% sobre vendas.</p></div>
          <div><strong>Produto</strong><Link href="/#recursos">Como funciona</Link><Link href="/#modelos">Layouts</Link><Link href="/#planos">Planos</Link><Link href="/criar">Criar loja</Link></div>
          <div><strong>Recursos</strong><Link href="/ajuda">Ajuda</Link><Link href="/blog">Blog</Link><Link href="/developers">Desenvolvedores</Link><Link href="/marca">Marca</Link></div>
          <div><strong>Acesso</strong><Link href="/entrar">Painel do lojista</Link><Link href="/termos-comerciais">Termos comerciais</Link><a href="https://avilaops.com">Avila Ops</a></div>
        </div>
        <div className="pl-container pl-footer-base"><span>© {new Date().getFullYear()} Avila Ops.</span>{temRastreio(pixels) && <PreferenciasCookies />}<span>Feito no Brasil para negócios que querem crescer.</span></div>
      </footer>
    </div>
  );
}
