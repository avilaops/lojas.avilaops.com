import { z } from "zod";
import { prisma } from "@/lib/db";
import { ProdutoEntradaSchema, TenantEntradaSchema } from "@/lib/admin-schemas";
import { criarTenant, importarProdutos } from "@/lib/admin-tenants";
import { slugificar } from "@/lib/catalogo";
import { anunciarLojaCriada, provisionarLoja } from "@/lib/provisionar";
import { abrirSessao, gerarHashSenha } from "@/lib/sessao";
import { urlDaLoja } from "@/lib/tenant";

/**
 * Autoatendimento: cria a loja, define a senha do lojista e abre a sessão.
 * O slug nasce do nome; se já existir, ganha um sufixo.
 */
const Entrada = TenantEntradaSchema.omit({ slug: true, mercadoPago: true }).extend({
  emailContato: z.string().email(),
  senha: z.string().min(8).max(200),
  produtos: z.array(ProdutoEntradaSchema).max(2000).optional(),
});

export async function POST(request: Request) {
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });
  const { senha, produtos, ...dados } = r.data;

  const email = dados.emailContato.toLowerCase();
  if (await prisma.tenant.findUnique({ where: { loginEmail: email } })) {
    return Response.json({ erro: "Já existe uma loja com este e-mail. Entre no painel." }, { status: 409 });
  }

  let slug = slugificar(dados.nome).slice(0, 40) || "loja";
  if (await prisma.tenant.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const tenant = await criarTenant({ ...dados, slug });
  await prisma.tenant.update({ where: { id: tenant.id }, data: { loginEmail: email, senhaHash: gerarHashSenha(senha), status: "ATIVA" } });

  let importados = { criados: 0, atualizados: 0 };
  if (produtos?.length) importados = await importarProdutos(tenant.id, produtos);

  await abrirSessao(slug);
  await anunciarLojaCriada(tenant);
  // Provisionamento (DNS/e-mail) segue em segundo plano; a resposta não espera.
  provisionarLoja(slug).catch((e) => console.error("[criar] provisionamento:", e));

  return Response.json({ slug, url: urlDaLoja(tenant), produtos: importados }, { status: 201 });
}
