import { exigir } from "@/lib/operadores";
import { testarRecebimento } from "@/lib/recebimento";
import { garantirCredencialMercadoPago } from "@/lib/credenciais";
import { prisma } from "@/lib/db";

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

  // Só persiste o veredito quando o teste usou a credencial já salva. O teste
  // do que ainda está digitado serve como pré-validação e não pode alterar o
  // gate de publicação antes de a credencial ser gravada.
  const tokenInformado = corpo?.accessToken?.trim();
  const chaveInformada = corpo?.publicKey?.trim();
  const testouCredencialSalva = !tokenInformado
    && (!chaveInformada || chaveInformada === loja.mpPublicKey?.trim())
    && Boolean(loja.mpAccessTokenEnc);
  if (testouCredencialSalva) {
    const credencial = await garantirCredencialMercadoPago(loja);
    if (credencial) {
      await prisma.credencialPagamento.update({
        where: { id: credencial.id },
        data: {
          status: diagnostico.ok ? "conectado" : "erro",
          mensagem: diagnostico.mensagem,
          conta: diagnostico.ok
            ? (diagnostico.conta?.apelido ?? diagnostico.conta?.email ?? credencial.conta)
            : credencial.conta,
          testadoEm: new Date(),
        },
      });
    }
  }

  return Response.json(diagnostico);
}
