import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { ESCOPOS, ESCOPOS_SECRETA, chaveMascarada, escoposDaChave, gerarChave, lerOrigens, planoPermite } from "@/lib/api-chaves";
import { lojaVende } from "@/lib/tenant";

/**
 * Chaves da API para desenvolvedores, no painel da loja.
 *
 * A chave inteira só existe na resposta do POST: o banco guarda o hash, então
 * nem a plataforma consegue mostrá-la de novo. Perdeu, cria outra e revoga a
 * antiga. Ver docs/API.md.
 */
export const dynamic = "force-dynamic";

/** Uma por integração é o uso esperado; centenas é chave esquecida, não integração. */
const MAXIMO_ATIVAS = 20;

export async function GET() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;

  const chaves = await prisma.chaveApi.findMany({
    where: { tenantId: s.tenant.id },
    orderBy: [{ revogadaEm: { sort: "desc", nulls: "first" } }, { criadaEm: "desc" }],
  });

  return Response.json({
    podeSecreta: planoPermite("SECRETA", s.tenant.plano),
    // Chave que vende só faz sentido em loja que vende: plano com checkout e
    // recebimento configurado.
    podeVender: lojaVende(s.tenant),
    escopos: ESCOPOS_SECRETA.map((e) => ({ escopo: e, descricao: ESCOPOS[e] })),
    chaves: chaves.map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      mascara: chaveMascarada(c),
      escopos: c.escopos,
      origens: c.origens,
      criadaEm: c.criadaEm,
      ultimoUsoEm: c.ultimoUsoEm,
      revogadaEm: c.revogadaEm,
    })),
  });
}

const NovaChave = z.object({
  nome: z.string().trim().min(2, "Dê um nome para reconhecer a chave (ex.: ERP).").max(60),
  tipo: z.enum(["SECRETA", "PUBLICAVEL"]),
  escopos: z.array(z.string()).default([]),
  /** Os sites de onde a chave publicável pode comprar. Só vale com `vitrine:comprar`. */
  origens: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  const lido = NovaChave.safeParse(await request.json().catch(() => null));
  if (!lido.success) return Response.json({ erro: lido.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  const { nome, tipo } = lido.data;

  if (!planoPermite(tipo, loja.plano)) {
    return Response.json(
      { erro: "A chave secreta da API é recurso do plano Loja Pro. A chave publicável (vitrine) está disponível no seu plano.", upgradeNecessario: true },
      { status: 403 },
    );
  }

  const ativas = await prisma.chaveApi.count({ where: { tenantId: loja.id, revogadaEm: null } });
  if (ativas >= MAXIMO_ATIVAS) {
    return Response.json({ erro: `A loja já tem ${MAXIMO_ATIVAS} chaves ativas. Revogue as que não usa antes de criar outra.` }, { status: 409 });
  }

  const escopos = escoposDaChave(tipo, lido.data.escopos);
  // Origens só existem em chave que compra; nas outras não significam nada, e
  // guardar seria prometer uma restrição que a leitura não aplica.
  let origens: string[] = [];
  if (escopos.includes("vitrine:comprar")) {
    const lidas = lerOrigens(lido.data.origens);
    if ("erro" in lidas) return Response.json({ erro: lidas.erro }, { status: 400 });
    origens = lidas.origens;
  }
  const gerada = gerarChave(tipo);
  const chave = await prisma.chaveApi.create({
    data: { tenantId: loja.id, tipo, nome, escopos, origens, hash: gerada.hash, prefixo: gerada.prefixo, final: gerada.final },
  });

  return Response.json({
    id: chave.id,
    nome: chave.nome,
    tipo: chave.tipo,
    escopos: chave.escopos,
    origens: chave.origens,
    chave: gerada.chave,
    mascara: chaveMascarada(chave),
    criadaEm: chave.criadaEm,
    mensagem: "Copie a chave agora: ela não será exibida de novo.",
  });
}
