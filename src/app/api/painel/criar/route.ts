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
  emailContato: z.string().email("Informe um e-mail válido."),
  // A régua inteira (boas-vindas, pedido pago, cobrança) fala pelo WhatsApp: sem ele a loja nasce muda.
  whatsapp: TenantEntradaSchema.shape.whatsapp.unwrap(),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(200),
  produtos: z.array(ProdutoEntradaSchema).max(2000).optional(),
});

const rotulos: Record<string, string> = {
  nome: "Nome da loja",
  emailContato: "E-mail",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  dominioPrincipal: "Domínio próprio",
  cepOrigem: "CEP",
  "endereco.cep": "CEP",
  "endereco.uf": "UF",
  despachoDiasUteis: "Prazo de despacho",
  senha: "Senha",
  produtos: "Catálogo",
};

function detalhesDaValidacao(error: z.ZodError) {
  return error.issues.map((issue) => {
    const campo = issue.path.join(".");
    const mensagensEspecificas: Record<string, string> = {
      nome: "Informe o nome da loja com pelo menos 2 caracteres.",
      emailContato: "Informe um e-mail válido.",
      whatsapp: "Informe DDD + número, por exemplo: (16) 99999-0000.",
      instagram: "Informe o link completo do Instagram, começando por https://.",
      dominioPrincipal: "Informe somente o domínio, por exemplo: sualoja.com.br.",
      cepOrigem: "Informe um CEP com 8 números.",
      "endereco.cep": "Informe um CEP com 8 números.",
      "endereco.uf": "Informe a UF com 2 letras, por exemplo: SP.",
      despachoDiasUteis: "Informe um prazo entre 0 e 30 dias úteis.",
      senha: "A senha precisa ter pelo menos 8 caracteres.",
      produtos: "Revise os produtos da planilha e tente novamente.",
    };
    return {
      campo,
      rotulo: rotulos[campo] ?? rotulos[issue.path[0]?.toString()] ?? "Informação",
      mensagem: mensagensEspecificas[campo] ?? (["Required", "Invalid input"].includes(issue.message) ? "Esta informação é obrigatória." : issue.message),
    };
  });
}

export async function POST(request: Request) {
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) {
    return Response.json({
      erro: "Algumas informações precisam ser corrigidas.",
      campos: detalhesDaValidacao(r.error),
    }, { status: 422 });
  }
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
