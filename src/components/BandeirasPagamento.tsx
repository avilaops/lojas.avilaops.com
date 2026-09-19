import { Barcode, CreditCard, QrCode, ShieldCheck } from "lucide-react";

/**
 * Como se paga nesta loja, no rodapé.
 *
 * É a única prova de confiança que a loja recém-aberta tem para mostrar: nota
 * e depoimento dependem de venda entregue, o meio de pagamento já está
 * configurado. E é dado, não enfeite — sai de `Tenant.meiosPagamento`, o mesmo
 * campo que o checkout usa para montar as opções, então o rodapé não pode
 * prometer boleto numa loja que desligou o boleto.
 *
 * Sem logotipo de bandeira de propósito: Visa, Mastercard e Pix têm regra de
 * uso de marca, e exibir a arte errada num rodapé que roda em N lojas é
 * problema de marca alheia. Ícone genérico e o nome do meio dizem o mesmo.
 */
const MEIOS: Record<string, { Icone: typeof CreditCard; rotulo: string }> = {
  pix: { Icone: QrCode, rotulo: "PIX" },
  cartao: { Icone: CreditCard, rotulo: "Cartão de crédito" },
  boleto: { Icone: Barcode, rotulo: "Boleto" },
};

export default function BandeirasPagamento({ meios }: { meios: string[] }) {
  const lista = meios.map((m) => MEIOS[m]).filter((m) => m !== undefined);
  if (lista.length === 0) return null;

  return (
    <div className="bandeiras-pagamento border-t border-border">
      <div className="container-loja flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Formas de pagamento</span>
        {lista.map(({ Icone, rotulo }) => (
          <span key={rotulo} className="inline-flex items-center gap-1.5">
            <Icone aria-hidden="true" className="h-4 w-4" />
            {rotulo}
          </span>
        ))}
        {/* O cadeado não afirma selo de terceiro: diz o que é verdade, que o
            pagamento acontece no gateway e a loja não guarda o cartão. */}
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Pagamento processado com criptografia
        </span>
      </div>
    </div>
  );
}
