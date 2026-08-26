import { notFound } from "next/navigation";
import { exigirTenant, enderecoDo, enderecoCompleto } from "@/lib/tenant";
import { mascararDocumento } from "@avilaops/checkout";

/**
 * Políticas padronizadas. Texto único da plataforma, preenchido com os dados
 * da loja. O lojista não edita — é o que garante que toda loja cumpra CDC
 * (arrependimento em 7 dias) e LGPD sem ninguém revisar texto por texto.
 */
const TIPOS = ["envio", "devolucao", "privacidade"] as const;
type Tipo = (typeof TIPOS)[number];

export function generateStaticParams() {
  return TIPOS.map((tipo) => ({ tipo }));
}

export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  return { title: { envio: "Envio e retirada", devolucao: "Trocas e devoluções", privacidade: "Privacidade" }[tipo] ?? "Políticas" };
}

export default async function Politica({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as Tipo)) notFound();
  const t = await exigirTenant();
  const e = enderecoDo(t);
  const cidade = e.cidade ? `${e.cidade}${e.uf ? "/" + e.uf : ""}` : "nossa loja";
  const contato = t.emailContato ?? (t.whatsapp ? "WhatsApp da loja" : "nossos canais de atendimento");
  const empresa = t.razaoSocial ?? t.nome;

  const conteudo: Record<Tipo, { titulo: string; paragrafos: string[] }> = {
    envio: {
      titulo: "Política de envio e retirada",
      paragrafos: [
        `Os pedidos são despachados em até ${t.despachoDiasUteis} dia(s) útil(eis) após a confirmação do pagamento. O prazo de entrega é o informado na cotação de frete no momento da compra e depende da transportadora e do CEP de destino.`,
        t.retiradaNaLoja ? `Você pode retirar o pedido sem custo em ${cidade}, a partir do próximo dia útil após a confirmação. Aguarde o aviso de "pedido separado" antes de ir até a loja.` : "Esta loja não oferece retirada no balcão.",
        `Em caso de avaria no transporte ou extravio, comunique-nos pelo ${contato} com fotos da embalagem. A reposição ou o estorno são por nossa conta.`,
      ],
    },
    devolucao: {
      titulo: "Trocas e devoluções",
      paragrafos: [
        "Compras feitas pela internet podem ser desfeitas em até 7 dias corridos após o recebimento, sem necessidade de justificativa, conforme o art. 49 do Código de Defesa do Consumidor. O produto deve ser devolvido sem uso e na embalagem original; o valor pago, incluindo o frete, é estornado pelo mesmo meio de pagamento.",
        "Produto com defeito pode ser trocado em até 30 dias (não duráveis) ou 90 dias (duráveis) a contar do recebimento. Nesses casos o custo do retorno é da loja.",
        `Para iniciar uma troca ou devolução, fale conosco pelo ${contato} informando o número do pedido.`,
      ],
    },
    privacidade: {
      titulo: "Política de privacidade",
      paragrafos: [
        `A ${empresa}${t.cnpj ? `, CNPJ ${mascararDocumento(t.cnpj)}` : ""}, é a controladora dos seus dados e coleta apenas os necessários para processar o pedido: nome, CPF/CNPJ, e-mail, telefone e endereço de entrega. Eles são usados para emitir a cobrança, entregar o produto e prestar atendimento, nos termos da Lei 13.709/2018 (LGPD).`,
        "Dados de cartão não passam por nossos servidores: são tokenizados pelo provedor de pagamento no seu navegador.",
        `Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo ${contato}. Os dados de pedidos são mantidos pelo prazo exigido pela legislação fiscal.`,
        "Esta loja usa cookies estritamente necessários para o funcionamento do carrinho e, quando configurado, ferramentas de medição de audiência.",
      ],
    },
  };

  const c = conteudo[tipo as Tipo];
  return (
    <div className="container-loja max-w-2xl py-10">
      <h1 className="text-2xl font-bold">{c.titulo}</h1>
      <div className="prosa mt-4 text-sm leading-relaxed">
        {c.paragrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {/* Identificação do fornecedor — Decreto 7.962/2013, art. 2º, I a III. */}
      <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Quem vende</p>
        <p className="mt-1">
          {empresa}
          {t.cnpj && ` · CNPJ ${mascararDocumento(t.cnpj)}`}
        </p>
        {enderecoCompleto(t) && <p>{enderecoCompleto(t)}</p>}
        {t.emailContato && <p>{t.emailContato}</p>}
        {t.telefone && <p>{t.telefone}</p>}
      </div>
    </div>
  );
}
