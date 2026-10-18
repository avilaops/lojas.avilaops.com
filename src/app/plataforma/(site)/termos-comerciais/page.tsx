import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos comerciais",
  description: "Regras de mensalidade e comissão para novos cadastros no Lojas Avila Ops.",
  alternates: { canonical: "https://lojas.avilaops.com/termos-comerciais" },
};

export default function TermosComerciaisPage() {
  const tituloSecao = "mt-8 text-xl font-semibold tracking-tight text-foreground";
  const paragrafo = "mt-3 text-base leading-7 text-muted-foreground";
  return (
    <div className="pl-site pl-site-claro">
    <article className="pl-container max-w-3xl py-16 sm:py-24">
      <p className="text-sm font-medium text-muted-foreground">Versão 1 · vigente desde 18 de outubro de 2026</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Termos comerciais</h1>
      <p className="mt-5 text-lg leading-8 text-muted-foreground">Estes termos se aplicam aos novos cadastros feitos na plataforma Lojas Avila Ops.</p>

      <h2 className={tituloSecao}>Preço</h2>
      <p className={paragrafo}>O cliente paga a mensalidade do plano escolhido e comissão de 5% sobre as vendas realizadas na plataforma.</p>

      <h2 className={tituloSecao}>Base da comissão</h2>
      <p className={paragrafo}>A comissão incide sobre o subtotal dos produtos efetivamente pagos, depois dos descontos. Frete, tributos destacados, juros e taxas do meio de pagamento não entram na base.</p>

      <h2 className={tituloSecao}>Quando a comissão é gerada</h2>
      <p className={paragrafo}>A comissão nasce quando o pagamento é confirmado. Pedido aguardando pagamento, autorização sem captura e cancelamento anterior à confirmação não geram comissão.</p>

      <h2 className={tituloSecao}>Reembolsos, devoluções e chargebacks</h2>
      <p className={paragrafo}>Reembolso, devolução parcial ou chargeback gera ajuste negativo proporcional. O lançamento original é preservado para manter o histórico verificável.</p>

      <h2 className={tituloSecao}>Fechamento e contestação</h2>
      <p className={paragrafo}>O demonstrativo é fechado no terceiro dia útil do mês seguinte e identifica os valores por pedido. O cliente pode contestar um item em até sete dias corridos; o item contestado fica suspenso até a decisão registrada.</p>

      <h2 className={tituloSecao}>Canais externos</h2>
      <p className={paragrafo}>Pedidos originados em marketplaces ou canais externos não entram na comissão, salvo aditivo comercial expresso.</p>

      <h2 className={tituloSecao}>Clientes anteriores</h2>
      <p className={paragrafo}>Clientes anteriores mantêm as condições do contrato vigente e só migram mediante adesão expressa.</p>

      <h2 className={tituloSecao}>Cancelamento</h2>
      <p className={paragrafo}>O cancelamento encerra cobranças futuras, sem apagar mensalidades, comissões e ajustes já devidos no período contratado.</p>

      <h2 className={tituloSecao}>Contato</h2>
      <p className={paragrafo}>Dúvidas, demonstrativos e contestações devem ser enviados pelos canais de suporte informados no painel.</p>
    </article>
    </div>
  );
}
