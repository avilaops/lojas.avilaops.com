/**
 * Eventos da plataforma → n8n.
 *
 * Toda automação comercial vive no n8n (regra da casa): boas-vindas, carrinho
 * abandonado, aviso de pedido pago no WhatsApp, reposição de estoque. A
 * plataforma só avisa o que aconteceu; o que fazer com isso é fluxo, não código.
 *
 * Falha no n8n nunca derruba a operação: o evento é logado e a vida segue.
 */
/** Dados do lojista que acompanham todo evento de pedido: o n8n avisa sem precisar consultar a API. */
export interface Lojista {
  lojaNome: string;
  lojaUrl: string;
  lojistaWhatsapp?: string | null;
  lojistaEmail?: string | null;
  emailRemetente?: string | null;
}

export type EventoPlataforma =
  | { tipo: "loja.criada"; slug: string; nome: string; url: string; emailContato?: string | null; whatsapp?: string | null }
  | { tipo: "loja.provisionada"; slug: string; passos: Record<string, string>; nome: string; url: string; emailContato?: string | null; whatsapp?: string | null }
  | { tipo: "loja.identidade-atualizada"; slug: string; nome: string; url: string; personalidade: string; direcaoFotografica: string; emailContato?: string | null; whatsapp?: string | null }
  | ({ tipo: "pedido.criado"; slug: string; referencia: string; numero?: number; total: number; meioPagamento: string; clienteNome: string; clienteEmail: string; clienteTelefone: string } & Lojista)
  | ({ tipo: "pedido.pago"; slug: string; referencia: string; numero?: number; total: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; itens: string } & Lojista)
  | ({ tipo: "pedido.recusado"; slug: string; referencia: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; motivo?: string } & Lojista)
  | { tipo: "lojista.recuperar-senha"; slug: string; nome: string; email: string; link: string }
  | { tipo: "loja.suspensa"; slug: string; nome: string; motivo: string; emailContato: string | null; whatsapp: string | null }
  | { tipo: "loja.reativada"; slug: string; nome: string; emailContato: string | null; whatsapp: string | null }
  | { tipo: "loja.mensalidade-paga"; slug: string; nome: string; centavos: number; emailContato: string | null; whatsapp: string | null }
  | { tipo: "loja.mensalidade-recusada"; slug: string; nome: string; tentativas: number; emailContato: string | null; whatsapp: string | null }
  | ({ tipo: "carrinho.abandonado"; slug: string; referencia: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; itens: string; total: number; linkCarrinho: string } & Lojista)
  | { tipo: "avaliacao.recebida"; slug: string; nome: string; produtoNome: string; nota: number; autor: string; emailContato: string | null; whatsapp: string | null }
  | { tipo: "loja.voltou-ao-estoque"; slug: string; nome: string; url: string; emailRemetente: string | null; destinatario: string; telefone: string | null; produtoNome: string; precoCentavos: number }
  | { tipo: "loja.relatorio-semanal"; slug: string; nome: string; url: string; emailContato: string | null; whatsapp: string | null; periodo: string; pedidosPagos: number; receitaCentavos: number; ticketMedioCentavos: number; topProdutos: string; carrinhosAbandonados: number; novasAvaliacoes: number };

export async function emitir(evento: EventoPlataforma): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.N8N_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({ ...evento, origem: "lojas.avilaops.com", em: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (erro) {
    console.error("[eventos] n8n indisponível:", evento.tipo, erro);
  }
}
