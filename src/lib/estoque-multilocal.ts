import { createHash, randomUUID } from "node:crypto";
import type { Prisma, SaldoEstoque } from "@prisma/client";
import { prisma } from "./db";
import { ErroApi } from "./api-resposta";
import { atualizarProjecao, travarProduto } from "./catalogo-escrita";
import { ChaveMovimento, MovimentoMultilocal, type MovimentoMultilocalInput } from "./estoque-multilocal-schema";

type Tx = Prisma.TransactionClient;
type SaldoResultado = { local: string; fisico: number; reservado: number; disponivel: number };
export type ReciboMovimento = { comandoId: string; varianteId: string; movimento: MovimentoMultilocalInput; saldos: SaldoResultado[] };

function saldoControlado(saldo: SaldoEstoque): asserts saldo is SaldoEstoque & { fisico: number } {
  if (saldo.fisico === null) throw new ErroApi("conflito", "Este local não controla estoque. Defina o saldo pelo cadastro antes de movimentar.");
}

async function saldoNoLocal(tx: Tx, tenantId: string, varianteId: string, local: string) {
  return tx.saldoEstoque.upsert({
    where: { tenantId_varianteId_local: { tenantId, varianteId, local } },
    create: { tenantId, varianteId, local, fisico: 0 },
    update: {},
  });
}

/** Mesma trava do catálogo e do checkout. Recibo, razão, projeção e saldos são atômicos. */
export async function movimentarEstoqueMultilocal(tenantId: string, chaveBruta: string, entrada: unknown, origem: string): Promise<ReciboMovimento> {
  const lido = MovimentoMultilocal.safeParse(entrada);
  const chave = ChaveMovimento.safeParse(chaveBruta);
  if (!lido.success || !chave.success) throw new ErroApi("parametro_invalido", "Movimento ou Idempotency-Key inválido.");
  const comando = lido.data;
  const resumoHash = createHash("sha256").update(JSON.stringify(comando)).digest("hex");

  return prisma.$transaction(async tx => {
    // Serializa a mesma chave até entre variantes diferentes. Colisão do hash só reduz paralelismo.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([tenantId, chave.data])}, 0))`;
    const anterior = await tx.comandoEstoque.findUnique({ where: { tenantId_chave: { tenantId, chave: chave.data } } });
    if (anterior) {
      if (anterior.resumoHash !== resumoHash) throw new ErroApi("conflito", "Idempotency-Key já utilizada com outro movimento.");
      return anterior.resultado as unknown as ReciboMovimento;
    }

    const variante = await tx.variante.findFirst({ where: { tenantId, id: comando.varianteId }, select: { produtoId: true } });
    if (!variante) throw new ErroApi("nao_encontrado", "Variante não encontrada nesta loja.");
    const produto = await travarProduto(tx, tenantId, variante.produtoId);
    if (!produto.variantes.some(v => v.id === comando.varianteId && v.ativo)) throw new ErroApi("conflito", "Variante removida ou inativa.");

    const comandoId = randomUUID();
    await tx.$executeRaw`SELECT set_config('lojas.estoque_comando', ${comandoId}, true), set_config('lojas.estoque_origem', ${origem}, true), set_config('lojas.estoque_motivo', ${comando.motivo}, true)`;
    const locais = comando.tipo === "transferencia" ? [comando.local, comando.destino].sort() : [comando.local];
    const saldos = [];
    for (const local of locais) {
      const saldo = await saldoNoLocal(tx, tenantId, comando.varianteId, local);
      // Também protege contra escritores SQL que não usam a trava do produto.
      await tx.$queryRaw`SELECT id FROM "SaldoEstoque" WHERE id=${saldo.id} FOR UPDATE`;
      const atual = await tx.saldoEstoque.findUniqueOrThrow({ where: { id: saldo.id } });
      saldoControlado(atual);
      saldos.push(atual);
    }

    const resultados: SaldoResultado[] = [];
    for (const saldo of saldos) {
      const delta = comando.tipo === "entrada" || comando.tipo === "transferencia" && saldo.local === comando.destino
        ? comando.quantidade : -comando.quantidade;
      const fisico = saldo.fisico + delta;
      if (fisico < saldo.reservado) throw new ErroApi("conflito", "Saldo disponível insuficiente; unidades reservadas não podem sair.");
      if (fisico > 2_147_483_647) throw new ErroApi("conflito", "Saldo excede o limite suportado.");
      await tx.saldoEstoque.update({ where: { id: saldo.id }, data: { fisico } });
      resultados.push({ local: saldo.local, fisico, reservado: saldo.reservado, disponivel: fisico - saldo.reservado });
    }

    await atualizarProjecao(tx, tenantId, produto.id);
    const atualizado = await tx.produto.update({ where: { id: produto.id }, data: { versaoCatalogo: { increment: 1 } } });
    await tx.eventoCatalogo.create({ data: { tenantId, produtoId: produto.id, versao: atualizado.versaoCatalogo, tipo: "catalogo.estoque-alterado" } });
    const resultado: ReciboMovimento = { comandoId, varianteId: comando.varianteId, movimento: comando, saldos: resultados };
    await tx.comandoEstoque.create({ data: { id: comandoId, tenantId, chave: chave.data, resumoHash, origem, resultado } });
    return resultado;
  }, { timeout: 20_000 });
}
