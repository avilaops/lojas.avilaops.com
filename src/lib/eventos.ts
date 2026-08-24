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
  | ({ tipo: "pedido.criado"; slug: string; referencia: string; numero?: number; total: number; meioPagamento: string; clienteNome: string; clienteEmail: string; clienteTelefone: string } & Lojista)
  | ({ tipo: "pedido.pago"; slug: string; referencia: string; numero?: number; total: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; itens: string } & Lojista)
  | ({ tipo: "pedido.recusado"; slug: string; referencia: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; motivo?: string } & Lojista);

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
