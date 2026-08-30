import { randomBytes } from "node:crypto";
import { lojistaAtual } from "@/lib/sessao";
import { prisma } from "@/lib/db";
import { cifrar } from "@/lib/cofre";

/** GET — Status da conexão MCP da loja e se possui chave ativa. */
export async function GET() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  const podeUsarMcp = loja.plano === "LOJA_PRO";
  const temChave = Boolean(loja.apiKeyEnc);

  return Response.json({
    plano: loja.plano,
    podeUsarMcp,
    temChave,
    apiKeyCriadaEm: loja.apiKeyCriadaEm,
    endpointUrl: "https://lojas.avilaops.com/api/mcp",
  });
}

/** POST — Gera ou rotaciona a chave de API da loja (Exclusivo LOJA_PRO). */
export async function POST() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  if (loja.plano !== "LOJA_PRO") {
    return Response.json(
      {
        erro: "O conector MCP para Claude / IA é um recurso exclusivo do plano Loja Pro (R$ 349/mês). Faça o upgrade na aba Assinatura para ativar.",
        upgradeNecessario: true,
      },
      { status: 403 },
    );
  }

  // Gera chave no padrão lojas_live_<slug>_<hex32>
  const tokenAleatorio = randomBytes(16).toString("hex");
  const chavePublica = `lojas_live_${loja.slug}_${tokenAleatorio}`;
  const apiKeyEnc = cifrar(chavePublica);
  const agora = new Date();

  await prisma.tenant.update({
    where: { id: loja.id },
    data: {
      apiKeyEnc,
      apiKeyCriadaEm: agora,
    },
  });

  return Response.json({
    sucesso: true,
    chave: chavePublica,
    criadaEm: agora,
    endpointUrl: "https://lojas.avilaops.com/api/mcp",
    mensagem: "Guarde esta chave com segurança. Ela não será exibida novamente por completo.",
  });
}

/** DELETE — Revoga a chave de API da loja. */
export async function DELETE() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  await prisma.tenant.update({
    where: { id: loja.id },
    data: {
      apiKeyEnc: null,
      apiKeyCriadaEm: null,
    },
  });

  return Response.json({
    sucesso: true,
    mensagem: "Chave de API revogada. O Claude e agentes externos não poderão mais acessar sua loja até que uma nova chave seja gerada.",
  });
}

