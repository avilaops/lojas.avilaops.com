import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { conferirDominio, dominioValido, limparDominio, registrosNecessarios } from "@/lib/dominio";
import { provisionarLoja } from "@/lib/provisionar";

/**
 * POST /api/painel/dominio — o lojista aponta o próprio domínio sozinho.
 *
 * Duas ações, porque são dois momentos separados por horas: salvar o domínio
 * (agora) e conferir se o DNS chegou (depois de o registrador propagar).
 *
 * Salvar já registra o apex e o www em `Tenant.dominios`, que é o que autoriza
 * o Caddy a emitir certificado quando o host aparecer. Sem isso o lojista
 * apontaria o DNS e receberia erro de certificado, sem entender por quê.
 */
export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  const corpo = (await request.json().catch(() => null)) as { acao?: string; dominio?: string } | null;
  const acao = corpo?.acao ?? "verificar";

  if (acao === "salvar") {
    const dominio = limparDominio(corpo?.dominio ?? "");
    if (!dominio) {
      // Remover é legítimo: o lojista volta para o endereço provisório.
      await prisma.tenant.update({ where: { id: loja.id }, data: { dominioPrincipal: null, dominios: [] } });
      return Response.json({ removido: true });
    }
    if (!dominioValido(dominio)) {
      return Response.json({ erro: "Informe só o domínio, como sualoja.com.br, sem https:// e sem barra." }, { status: 422 });
    }

    const emUso = await prisma.tenant.findFirst({
      where: { dominios: { has: dominio }, NOT: { id: loja.id } },
      select: { id: true },
    });
    if (emUso) return Response.json({ erro: "Este domínio já está em uso por outra loja." }, { status: 409 });

    await prisma.tenant.update({
      where: { id: loja.id },
      data: { dominioPrincipal: dominio, dominios: [dominio, `www.${dominio}`] },
    });

    // Se a zona estiver na nossa Cloudflare, isto cria os registros sozinho e o
    // lojista não precisa fazer nada. Se não estiver, devolve "pendente" e a
    // tela mostra o que ele precisa criar no painel do registrador dele.
    const provisionamento = await provisionarLoja(loja.slug).catch(() => null);
    const conferencia = await conferirDominio(dominio);
    return Response.json({ salvo: true, dominio, provisionamento, conferencia, registros: registrosNecessarios(loja, dominio) });
  }

  const dominio = limparDominio(corpo?.dominio || loja.dominioPrincipal || "");
  if (!dominio) return Response.json({ erro: "Nenhum domínio salvo para conferir." }, { status: 422 });
  return Response.json({ conferencia: await conferirDominio(dominio), registros: registrosNecessarios(loja, dominio) });
}
