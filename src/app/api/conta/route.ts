import { z } from "zod";
import { tenantAtual } from "@/lib/tenant";
import { ContaErro, abrirConta, adotarPedidosAnteriores, autenticar, compradorAtual, criarConta, fecharConta } from "@/lib/conta";
import { prisma } from "@/lib/db";

const Cadastro = z.object({
  acao: z.literal("cadastrar"),
  nome: z.string().trim().min(2).max(80),
  email: z.string().email(),
  senha: z.string().min(8).max(200),
  telefone: z.string().optional(),
  documento: z.string().optional(),
});
const Login = z.object({ acao: z.literal("entrar"), email: z.string().email(), senha: z.string().min(1) });

/** POST — cadastrar ou entrar na conta da loja. */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const corpo = await request.json().catch(() => null);

  try {
    const cad = Cadastro.safeParse(corpo);
    if (cad.success) {
      const c = await criarConta(t, cad.data);
      await adotarPedidosAnteriores(c);
      await abrirConta(c, t.slug);
      return Response.json({ ok: true, nome: c.nome }, { status: 201 });
    }
    const log = Login.safeParse(corpo);
    if (log.success) {
      const c = await autenticar(t, log.data.email, log.data.senha);
      await abrirConta(c, t.slug);
      return Response.json({ ok: true, nome: c.nome });
    }
    return Response.json({ erro: "Preencha os campos corretamente." }, { status: 422 });
  } catch (erro) {
    if (erro instanceof ContaErro) return Response.json({ erro: erro.message }, { status: erro.status });
    console.error("[conta]", erro);
    return Response.json({ erro: "Não foi possível concluir agora." }, { status: 500 });
  }
}

/** GET — dados da conta logada (o checkout usa para pré-preencher). */
export async function GET() {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const c = await compradorAtual(t);
  if (!c) return Response.json({ logado: false });
  const enderecos = await prisma.enderecoComprador.findMany({ where: { compradorId: c.id }, orderBy: [{ principal: "desc" }] });
  return Response.json({
    logado: true,
    nome: c.nome,
    email: c.email,
    telefone: c.telefone,
    documento: c.documento,
    enderecos: enderecos.map((e) => ({ id: e.id, apelido: e.apelido, cep: e.cep, logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, principal: e.principal })),
  });
}

export async function DELETE() {
  await fecharConta();
  return Response.json({ ok: true });
}
