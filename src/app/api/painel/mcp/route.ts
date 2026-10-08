import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";
import { prisma } from "@/lib/db";

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

/**
 * POST — a chave antiga do conector (`lojas_live_…`) não é mais emitida.
 *
 * Ela ficava cifrada no `Tenant`, uma por loja e com acesso inteiro. Quem
 * precisa de chave para n8n ou script cria uma chave secreta com o escopo
 * `mcp:usar` em Chaves da API: fica só o hash, dá para ter várias e cada uma
 * pode só o que foi marcado. As chaves antigas que existem seguem valendo até
 * serem revogadas aqui. Ver docs/MCP.md.
 */
export async function POST() {
  const { erro } = await exigir("configuracoes");
  if (erro) return erro;
  return Response.json(
    { erro: "Esta chave não é mais emitida. Crie uma chave secreta com o escopo mcp:usar em Chaves da API, logo abaixo." },
    { status: 410 },
  );
}

/** DELETE — Revoga a chave de API da loja. */
export async function DELETE() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  await prisma.tenant.update({
    where: { id: loja.id },
    data: {
      apiKeyEnc: null,
      apiKeyCriadaEm: null,
    },
  });

  return Response.json({
    sucesso: true,
    mensagem: "Chave antiga revogada. As automações que a usavam param agora; os assistentes conectados por login e as chaves secretas continuam.",
  });
}

