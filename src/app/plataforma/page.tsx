import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loja virtual pronta em minutos — Lojas by Avila Ops",
  description: "Loja com PIX, cartão e boleto, frete por CEP, e-mail profissional e automações de WhatsApp. Setup R$ 497, a partir de R$ 79/mês.",
};

const PLANOS = [
  { nome: "Site", preco: 79, itens: ["Vitrine de produtos", "Pedido pelo WhatsApp", "Domínio, hospedagem, SSL", "1 e-mail profissional", "Painel + treinamento em vídeo"] },
  { nome: "Loja", preco: 119, destaque: true, itens: ["Tudo do Site", "Carrinho e checkout na sua loja", "PIX na hora, cartão em até 12x, boleto", "Frete por CEP + retirada na loja", "Aviso de pedido pago no seu WhatsApp"] },
  { nome: "Loja Pro", preco: 349, itens: ["Tudo da Loja", "Carrinho abandonado e pós-venda automáticos", "Cupons e reposição de estoque", "Relatórios semanais + 5 e-mails", "Emissão de NF-e"] },
];

export default function LandingPlataforma() {
  return (
    <div className="container-loja py-12">
      <section className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Loja virtual padronizada</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight">Sua loja no ar em minutos, vendendo com PIX, cartão e boleto.</h1>
        <p className="mt-4 text-muted-foreground">
          Você preenche um formulário; a gente cuida de domínio, hospedagem, e-mail, pagamento e frete. O dinheiro cai direto na sua conta. Sem programador, sem mensalidade escondida.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/criar" className="btn-primario">Criar minha loja</Link>
          <a href="https://demo.lojas.avilaops.com" target="_blank" rel="noopener" className="btn-secundario">Ver loja de exemplo</a>
        </div>
      </section>

      <section id="planos" className="mt-16">
        <h2 className="text-2xl font-bold">Planos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Setup de R$ 1.307 por <strong>R$ 497</strong> (12x de R$ 49,70) com 2 indicações após a aprovação.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PLANOS.map((p) => (
            <div key={p.nome} className={`rounded-2xl border p-6 ${p.destaque ? "border-primary shadow-lg" : "border-border"}`}>
              {p.destaque && <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Mais escolhido</p>}
              <h3 className="mt-1 text-xl font-bold">{p.nome}</h3>
              <p className="mt-2 text-3xl font-bold">R$ {p.preco}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.itens.map((i) => <li key={i}>✔ {i}</li>)}
              </ul>
              <Link href={`/criar?plano=${p.nome === "Site" ? "SITE" : p.nome === "Loja" ? "LOJA" : "LOJA_PRO"}`} className={`${p.destaque ? "btn-primario" : "btn-secundario"} mt-6 w-full`}>
                Começar com {p.nome}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          ["Padrão que funciona", "Um layout testado, cores e fonte suas. Sem reinventar: é o que deixa o preço baixo e a loja rápida."],
          ["Dinheiro na sua conta", "Pagamento pelo Mercado Pago da sua empresa. Nós não intermediamos o dinheiro."],
          ["Automação de verdade", "Pedido pago avisa no seu WhatsApp; carrinho abandonado recebe lembrete; tudo sem você fazer nada."],
        ].map(([t, d]) => (
          <div key={t}>
            <h3 className="font-bold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
