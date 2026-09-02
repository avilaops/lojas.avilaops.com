import { exigir } from "@/lib/operadores";
import { testarRecebimento } from "@/lib/recebimento";

/**
 * POST: testa a credencial do Mercado Pago da loja.
 *
 * Aceita o que está digitado na tela (para conferir antes de salvar) e cai no
 * que já está salvo quando o corpo vem vazio. O token nunca volta na resposta
 * nem vai para log: o que sai daqui é o veredito e o apelido da conta.
 */
export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  const corpo = (await request.json().catch(() => null)) as
    | { accessToken?: string; publicKey?: string }
    | null;

  const diagnostico = await testarRecebimento(loja, {
    accessToken: typeof corpo?.accessToken === "string" ? corpo.accessToken : undefined,
    publicKey: typeof corpo?.publicKey === "string" ? corpo.publicKey : undefined,
  });

  return Response.json(diagnostico);
}
