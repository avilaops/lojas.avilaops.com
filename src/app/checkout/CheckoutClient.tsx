"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckoutScreen, MercadoPagoCardBrick } from "@avilaops/checkout/ui";
import { FRETE_RETIRADA_ID, avaliarPedidoMinimo, avisoDePedidoMinimo, type ItemCarrinho, type MeioPagamento, type OpcaoFrete, type ResultadoPagamento } from "@avilaops/checkout";
import { useCart } from "@/components/cart/CartProvider";
import { iniciarCheckout } from "@/lib/eventos-loja";
import { desfechoDoCheckout, esquecerPendencia, guardaDoNavegador, guardarPendencia, lerPendencia, lerSituacao } from "@/lib/pedido-a-confirmar";
import type { TenantPublico } from "@/lib/tenant";

/**
 * A tela é a do @avilaops/checkout — a mesma em todas as lojas. O que este
 * arquivo faz é ligar carrinho local → frete da loja → /api/checkout, e
 * decidir o que mostrar depois (PIX, boleto, aprovado).
 */

/**
 * A referência é segredo, não identificador.
 *
 * `/pedido/[referencia]` mostra nome, e-mail, itens, total e rastreio sem pedir
 * sessão — quem tem o link vê o pedido. Então o que separa o cliente de um
 * estranho é só a dificuldade de adivinhar esta string.
 *
 * `Math.random()` não serve para isso: não é criptográfico, e seis caracteres
 * de base 36 davam por volta de 31 bits, ao lado de um timestamp em
 * milissegundos que se estreita sozinho quando se sabe mais ou menos quando a
 * compra foi feita. `randomUUID` são 122 bits de fonte criptográfica.
 *
 * Continua nascendo no navegador de propósito: é ela que dá idempotência
 * quando o POST do checkout é repetido, então precisa existir antes da
 * primeira tentativa. E não há reserva para `crypto.randomUUID` ausente —
 * cair de volta em `Math.random()` devolveria o furo em silêncio, que é pior
 * do que falhar à vista.
 */
function novaReferencia(slug: string) {
  const segredo = crypto.randomUUID().replace(/-/g, "");
  return `${slug}-${Date.now().toString(36)}-${segredo}`.toUpperCase();
}

export default function CheckoutClient({ loja, conta }: { loja: TenantPublico; conta: { nome: string; email: string; telefone: string | null; documento: string | null; endereco: { cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string } | null } | null }) {
  const { itens, limpar, pronto, cupom } = useCart();
  const router = useRouter();
  const [fretes, setFretes] = useState<OpcaoFrete[]>(() =>
    loja.retiradaNaLoja ? [{ id: FRETE_RETIRADA_ID, nome: "Retirar na loja", preco: 0, prazoDiasUteis: loja.despachoDiasUteis }] : [],
  );
  const [resultado, setResultado] = useState<ResultadoPagamento | null>(null);
  const [referencia] = useState(() => novaReferencia(loja.slug));
  // Referência de uma visita anterior cujo pagamento ficou a confirmar. Enquanto
  // ela não resolver, o formulário não abre: ele nasceria com referência nova,
  // fora da trava de repetição, e cobraria de novo com a primeira em aberto.
  const [anterior, setAnterior] = useState<{ referencia: string; situacao: "conferindo" | "pendente" | "pedido" } | null>(null);
  const [anteriorLida, setAnteriorLida] = useState(false);
  // Pagamento desta visita que ficou a confirmar: a tela troca na hora, com o
  // link à vista, em vez de depender de a navegação acontecer.
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);

  const itensCheckout = useMemo<ItemCarrinho[]>(
    () => itens.map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, precoUnitario: i.precoCentavos, imagem: i.imagem })),
    [itens],
  );
  const ids = useMemo(() => itens.map((i) => ({ id: i.id, quantidade: i.quantidade })), [itens]);

  // Um begin_checkout por visita à tela, quando o carrinho já carregou.
  const jaAvisou = useRef(false);
  useEffect(() => {
    if (!pronto || jaAvisou.current || itens.length === 0) return;
    jaAvisou.current = true;
    iniciarCheckout(itens.map((i) => ({ id: i.id, nome: i.nome, precoCentavos: i.precoCentavos, quantidade: i.quantidade })));
  }, [pronto, itens]);

  const conferirAnterior = useCallback(async (ref: string) => {
    setAnterior({ referencia: ref, situacao: "conferindo" });
    const corpo = await fetch(`/api/checkout/pendente?referencia=${encodeURIComponent(ref)}`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const situacao = lerSituacao(corpo);
    if (situacao === "livre") {
      esquecerPendencia(guardaDoNavegador(), loja.slug);
      setAnterior(null);
    } else {
      // Consulta que falhou conta como pendente: na dúvida, não se cobra de novo.
      setAnterior({ referencia: ref, situacao: situacao ?? "pendente" });
    }
  }, [loja.slug]);

  /* eslint-disable react-hooks/set-state-in-effect -- lê a pendência do armazenamento externo do navegador, como o carrinho */
  useEffect(() => {
    const ref = lerPendencia(guardaDoNavegador(), loja.slug);
    setAnteriorLida(true);
    if (ref) void conferirAnterior(ref);
  }, [loja.slug, conferirAnterior]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Polling do PIX: quando cair, vai para a página do pedido.
  useEffect(() => {
    if (!resultado || resultado.status !== "pendente" || resultado.meioPagamento !== "pix") return;
    const timer = setInterval(async () => {
      const r = await fetch(`/api/checkout/status?id=${encodeURIComponent(resultado.id)}`).then((x) => x.json()).catch(() => null);
      if (r?.status === "aprovado") {
        clearInterval(timer);
        limpar();
        router.push(`/pedido/${referencia}`);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [resultado, limpar, referencia, router]);

  if (!pronto || !anteriorLida) return null;

  if (aConfirmar) {
    return (
      <div className="container-loja max-w-lg py-16 text-center">
        <h1 className="text-xl font-bold">Estamos confirmando o pagamento</h1>
        <p className="mt-2 text-sm text-muted-foreground">Não pague de novo. A resposta do pagamento ainda não chegou; acompanhe pela página do pedido.</p>
        <Link href={aConfirmar} className="btn-primario mt-6 w-full">Acompanhar o pedido</Link>
      </div>
    );
  }

  if (anterior && !resultado) {
    const destino = `/pedido/${encodeURIComponent(anterior.referencia)}`;
    if (anterior.situacao === "conferindo") {
      return (
        <div className="container-loja max-w-lg py-16 text-center">
          <p className="text-sm text-muted-foreground">Conferindo um pagamento anterior…</p>
        </div>
      );
    }
    if (anterior.situacao === "pedido") {
      return (
        <div className="container-loja max-w-lg py-16 text-center">
          <h1 className="text-xl font-bold">Sua compra anterior já virou pedido</h1>
          <p className="mt-2 text-sm text-muted-foreground">O pagamento que estava a confirmar gerou um pedido. Veja o pedido antes de comprar de novo: os itens do carrinho podem ser os mesmos.</p>
          <Link href={destino} className="btn-primario mt-6 w-full">Ver o pedido</Link>
          <button type="button" className="btn-secundario mt-2 w-full" onClick={() => { esquecerPendencia(guardaDoNavegador(), loja.slug); setAnterior(null); }}>
            Fazer outra compra
          </button>
        </div>
      );
    }
    return (
      <div className="container-loja max-w-lg py-16 text-center">
        <h1 className="text-xl font-bold">Você tem um pagamento em confirmação</h1>
        <p className="mt-2 text-sm text-muted-foreground">Não pague de novo. Seu pagamento anterior ainda não foi resolvido; finalizar outra compra agora poderia cobrar duas vezes. Seu carrinho continua guardado.</p>
        <Link href={destino} className="btn-primario mt-6 w-full">Acompanhar o pedido</Link>
        <button type="button" className="btn-secundario mt-2 w-full" onClick={() => void conferirAnterior(anterior.referencia)}>
          Conferir de novo
        </button>
      </div>
    );
  }

  if (itens.length === 0 && !resultado) {
    return (
      <div className="container-loja py-16 text-center">
        <p>Seu carrinho está vazio.</p>
        <Link href="/produtos" className="btn-primario mt-4">Ver produtos</Link>
      </div>
    );
  }

  // Quem chega aqui pela URL com o carrinho abaixo do pedido mínimo volta para
  // o carrinho em vez de preencher tudo e só então ser recusado pelo servidor.
  const avisoMinimo = resultado ? null : avisoDePedidoMinimo(avaliarPedidoMinimo(itens.reduce((s, i) => s + i.precoCentavos * i.quantidade, 0), loja.pedidoMinimoCentavos));
  if (avisoMinimo) {
    return (
      <div className="container-loja py-16 text-center">
        <p>{avisoMinimo}</p>
        <Link href="/carrinho" className="btn-primario mt-4">Voltar ao carrinho</Link>
      </div>
    );
  }

  async function aoInformarCep(cep: string) {
    const r = await fetch("/api/frete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cep, itens: ids, cupom: cupom?.codigo }) });
    const opcoes = (await r.json()) as OpcaoFrete[];
    setFretes(opcoes);
    return opcoes;
  }

  async function aoFinalizar(dados: Parameters<NonNullable<React.ComponentProps<typeof CheckoutScreen>["aoFinalizar"]>>[0]) {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        referencia,
        itens: ids,
        cupom: cupom?.codigo,
        cliente: dados.cliente,
        entrega: dados.entrega,
        freteId: dados.freteId,
        meioPagamento: dados.meioPagamento,
        cartao: dados.cartaoToken ? { token: dados.cartaoToken, parcelas: dados.parcelas, bandeira: dados.bandeira } : undefined,
      }),
    });
    const corpo = await r.json().catch(() => null);
    const desfecho = desfechoDoCheckout(r.ok, corpo, referencia);
    if (desfecho.tipo === "erro") throw new Error(desfecho.mensagem);
    if (desfecho.tipo === "a_confirmar") {
      // Cobrança que pode ter nascido (ou nasceu, e só a resposta se perdeu) não
      // reabre o formulário. A referência fica guardada para a próxima visita ao
      // /checkout, o carrinho também, e a tela troca para um aviso com o link:
      // se a navegação falhar, o comprador não fica diante de um botão travado.
      // A promessa não resolve de propósito, para a tela de pagamento (que sai
      // de cena nesta mesma renderização) não chegar a dizer "nada foi cobrado".
      guardarPendencia(guardaDoNavegador(), loja.slug, desfecho.referencia);
      setAConfirmar(desfecho.destino);
      router.push(desfecho.destino);
      return new Promise<ResultadoPagamento>(() => {});
    }
    const res = desfecho.resultado;
    setResultado(res);
    if (res.status === "aprovado") {
      limpar();
      router.push(`/pedido/${referencia}`);
    } else if (res.meioPagamento === "boleto") {
      limpar();
    }
    return res;
  }

  if (resultado && resultado.status === "pendente" && resultado.pix) {
    return (
      <div className="container-loja max-w-lg py-10 text-center">
        <h1 className="text-xl font-bold">Pague com PIX</h1>
        <p className="mt-1 text-sm text-muted-foreground">Abra o app do seu banco e escaneie o código. A confirmação é automática.</p>
        {resultado.pix.qrCodeBase64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${resultado.pix.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto mt-6 h-56 w-56 rounded-lg border border-border bg-white p-2" />
        )}
        <textarea readOnly value={resultado.pix.copiaECola} className="mt-4 h-24 w-full rounded-lg border border-border bg-card p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button className="btn-secundario mt-2 w-full" onClick={() => navigator.clipboard?.writeText(resultado.pix!.copiaECola)}>
          Copiar código
        </button>
        <p className="mt-4 text-xs text-muted-foreground">Pedido {referencia}</p>
      </div>
    );
  }

  if (resultado && resultado.boleto) {
    return (
      <div className="container-loja max-w-lg py-10 text-center">
        <h1 className="text-xl font-bold">Boleto gerado</h1>
        <p className="mt-1 text-sm text-muted-foreground">O pedido é confirmado após a compensação (até 3 dias úteis).</p>
        <a href={resultado.boleto.url} target="_blank" rel="noopener" className="btn-primario mt-6 w-full">Abrir boleto</a>
        {resultado.boleto.linhaDigitavel && <p className="mt-3 break-all text-xs">{resultado.boleto.linhaDigitavel}</p>}
        <Link href={`/pedido/${referencia}`} className="btn-secundario mt-2 w-full">Ver pedido</Link>
      </div>
    );
  }

  return (
    <div className="container-loja py-8">
      <h1 className="mb-6 text-2xl font-bold">Finalizar compra</h1>
      <CheckoutScreen
        itens={itensCheckout}
        fretes={fretes}
        meiosPagamento={loja.meiosPagamento as MeioPagamento[]}
        clienteInicial={conta ? { nome: conta.nome.split(" ")[0], sobrenome: conta.nome.split(" ").slice(1).join(" "), email: conta.email, telefone: conta.telefone ?? "", documento: conta.documento ?? "" } : undefined}
        enderecoInicial={conta?.endereco ? { ...conta.endereco, complemento: conta.endereco.complemento ?? "" } : undefined}
        aoInformarCep={aoInformarCep}
        aoIdentificar={(cliente) => { void fetch("/api/checkout/contato", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ referencia, cliente, itens: ids }) }).catch(() => undefined); }}
        aoFinalizar={aoFinalizar}
        desconto={cupom?.desconto ?? 0}
        slotCartao={
          loja.mpPublicKey
            ? ({ totalEmCentavos, emailCliente, aoTokenizar }) => (
                <MercadoPagoCardBrick publicKey={loja.mpPublicKey!} totalEmCentavos={totalEmCentavos} emailCliente={emailCliente} aoTokenizar={aoTokenizar} />
              )
            : undefined
        }
      />
    </div>
  );
}
