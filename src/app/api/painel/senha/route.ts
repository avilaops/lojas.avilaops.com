import { z } from "zod";
import { prisma } from "@/lib/db";
import { conferirSenha, gerarHashSenha, lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";

const Entrada = z.object({ atual: z.string().min(1), nova: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const { s, erro } = await exigir("cobranca");
  if (erro) return erro;
  const loja = s.tenant;
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Senha nova precisa ter 8+ caracteres." }, { status: 422 });
  if (!conferirSenha(r.data.atual, loja.senhaHash)) return Response.json({ erro: "Senha atual incorreta." }, { status: 401 });
  await prisma.tenant.update({ where: { id: loja.id }, data: { senhaHash: gerarHashSenha(r.data.nova) } });
  return Response.json({ ok: true });
}
