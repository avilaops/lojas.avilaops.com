import { z } from "zod";
import { tenantAtual } from "@/lib/tenant";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { cotarFrete } from "@/lib/frete";
import { buscarCupomValido } from "@/lib/cupons";
import { medirRota } from "@/lib/metricas-rota";
import { alertar } from "@/lib/alertas";

const Entrada = z.object({
  cep: z.string(),
  itens: z.array(z.object({ id: z.string(), quantidade: z.number().int().positive() })).min(1),
  cupom: z.string().max(40).optional(),
});

/** POST { cep, itens:[{id,quantidade}] } → OpcaoFrete[] (cotado no servidor, pelo catálogo). */
export const POST = medirRota("frete", async function (request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "requisição inválida" }, { status: 400 });

  const itens = await resolverItensDoCatalogo(t.id, r.data.itens);
  let freteGratisCupom = false;
  if (r.data.cupom) {
    const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
    const c = await buscarCupomValido(t.id, r.data.cupom, subtotal);
    freteGratisCupom = "cupom" in c && c.cupom.tipo === "FRETE_GRATIS";
  }
  const opcoes = await cotarFrete(t, r.data.cep, itens, { freteGratisCupom });
  // CEP inteiro e nenhuma forma de entrega: o comprador não fecha o pedido, e
  // sem este aviso ninguém fica sabendo (a Vedashow passou dias assim). Um por
  // loja por dia; `alertar` nunca lança.
  if (!opcoes.length && r.data.cep.replace(/\D/g, "").length === 8) {
    void alertar({
      codigo: "frete.sem-opcao",
      slug: t.slug,
      lojaNome: t.nome,
      recurso: "frete",
      detalhe: `CEP ${r.data.cep.replace(/\D/g, "").slice(0, 5)}-***, ${itens.length} item(ns) no carrinho`,
      link: "/painel/configuracoes/entrega",
      ocorrencia: new Date().toISOString().slice(0, 10),
    });
  }
  return Response.json(opcoes);
});
