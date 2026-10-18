import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PapelCorporativoB2B } from "@prisma/client";
import { validarCnpj } from "../../packages/checkout/src/core/brasil";
import { prisma } from "./db";

export function normalizarCnpjB2B(valor: string): string {
  const cnpj = valor.replace(/\D/g, "");
  if (cnpj.length !== 14) throw new Error("CNPJ deve ter 14 dígitos.");
  if (!validarCnpj(cnpj)) throw new Error("CNPJ inválido.");
  return cnpj;
}

export function normalizarEmailB2B(valor: string): string {
  const email = valor.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  return email;
}

export function validarOrcamentoB2B(valor: number): number {
  if (!Number.isSafeInteger(valor) || valor < 0) throw new Error("Orçamento deve ser um inteiro não negativo em centavos.");
  return valor;
}

type EnderecoB2B = {
  tipo: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  principal?: boolean;
};

export type EntradaEmpresaB2B = {
  referencia: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  unidades: Array<{
    referencia: string;
    nome: string;
    cnpj: string;
    inscricaoEstadual?: string | null;
    enderecos: EnderecoB2B[];
  }>;
  contatos: Array<{
    tipo: string;
    nome: string;
    cargo?: string | null;
    email?: string | null;
    telefone?: string | null;
    referenciaUnidade?: string | null;
    principal?: boolean;
  }>;
  centrosCusto: Array<{ codigo: string; nome: string; orcamentoMensalCentavos: number; ativo?: boolean }>;
  compradores: Array<{
    nome: string;
    email: string;
    centrosCusto: string[];
    autorizacoes: Array<{
      papel: PapelCorporativoB2B;
      referenciaUnidade: string | null;
      limiteAprovacaoCentavos: number | null;
    }>;
  }>;
};

export type AtorB2B = { tipo: string; id?: string | null; email?: string | null };

function textoObrigatorio(valor: string, campo: string, max = 200): string {
  const texto = valor.trim();
  if (!texto || texto.length > max) throw new Error(`${campo} inválido.`);
  return texto;
}

function referencia(valor: string, campo: string): string {
  const texto = textoObrigatorio(valor, campo, 80).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(texto)) throw new Error(`${campo} inválida.`);
  return texto;
}

const incluirAgregado = {
  unidades: { include: { enderecos: true }, orderBy: { referencia: "asc" } },
  contatos: { orderBy: { nome: "asc" } },
  centrosCusto: { orderBy: { codigo: "asc" } },
  compradores: {
    include: { autorizacoes: { orderBy: [{ versao: "asc" }, { papel: "asc" }] }, centrosCusto: true, provisionamento: true },
    orderBy: { emailNormalizado: "asc" },
  },
} satisfies Prisma.EmpresaB2BInclude;

function hashIntencao(valor: unknown): string {
  return createHash("sha256").update(JSON.stringify(valor)).digest("hex");
}

async function salvarNaTransacao(tx: Prisma.TransactionClient, tenantId: string, entrada: EntradaEmpresaB2B, ator: AtorB2B) {
  const referenciaEmpresa = referencia(entrada.referencia, "Referência da empresa");
  const razaoSocial = textoObrigatorio(entrada.razaoSocial, "Razão social", 160);
  const anterior = await tx.empresaB2B.findUnique({ where: { tenantId_referencia: { tenantId, referencia: referenciaEmpresa } }, include: incluirAgregado });
  const empresa = await tx.empresaB2B.upsert({
    where: { tenantId_referencia: { tenantId, referencia: referenciaEmpresa } },
    create: { tenantId, referencia: referenciaEmpresa, razaoSocial, nomeFantasia: entrada.nomeFantasia?.trim() || null },
    update: { razaoSocial, nomeFantasia: entrada.nomeFantasia?.trim() || null, versao: { increment: 1 } },
  });

  const unidadesPorReferencia = new Map<string, { id: string; nome: string }>();
  for (const item of entrada.unidades) {
    const ref = referencia(item.referencia, "Referência da unidade");
    const unidade = await tx.unidadeEmpresaB2B.upsert({
      where: { tenantId_empresaId_referencia: { tenantId, empresaId: empresa.id, referencia: ref } },
      create: {
        tenantId,
        empresaId: empresa.id,
        referencia: ref,
        nome: textoObrigatorio(item.nome, "Nome da unidade", 160),
        cnpj: normalizarCnpjB2B(item.cnpj),
        inscricaoEstadual: item.inscricaoEstadual?.trim() || null,
      },
      update: {
        nome: textoObrigatorio(item.nome, "Nome da unidade", 160),
        cnpj: normalizarCnpjB2B(item.cnpj),
        inscricaoEstadual: item.inscricaoEstadual?.trim() || null,
        ativa: true,
      },
    });
    unidadesPorReferencia.set(ref, { id: unidade.id, nome: unidade.nome });
    await tx.enderecoUnidadeEmpresaB2B.deleteMany({ where: { tenantId, unidadeId: unidade.id } });
    if (item.enderecos.length) {
      await tx.enderecoUnidadeEmpresaB2B.createMany({
        data: item.enderecos.map((endereco) => ({
          tenantId,
          unidadeId: unidade.id,
          tipo: textoObrigatorio(endereco.tipo, "Tipo do endereço", 40),
          cep: textoObrigatorio(endereco.cep.replace(/\D/g, ""), "CEP", 8),
          logradouro: textoObrigatorio(endereco.logradouro, "Logradouro", 160),
          numero: textoObrigatorio(endereco.numero, "Número", 30),
          complemento: endereco.complemento?.trim() || null,
          bairro: textoObrigatorio(endereco.bairro, "Bairro", 100),
          cidade: textoObrigatorio(endereco.cidade, "Cidade", 100),
          uf: textoObrigatorio(endereco.uf, "UF", 2).toUpperCase(),
          principal: endereco.principal ?? false,
        })),
      });
    }
  }
  await tx.unidadeEmpresaB2B.updateMany({
    where: { tenantId, empresaId: empresa.id, referencia: { notIn: [...unidadesPorReferencia.keys()] }, ativa: true },
    data: { ativa: false },
  });

  await tx.contatoEmpresaB2B.deleteMany({ where: { tenantId, empresaId: empresa.id } });
  if (entrada.contatos.length) {
    await tx.contatoEmpresaB2B.createMany({
      data: entrada.contatos.map((contato) => {
        const unidade = contato.referenciaUnidade ? unidadesPorReferencia.get(referencia(contato.referenciaUnidade, "Referência da unidade")) : null;
        if (contato.referenciaUnidade && !unidade) throw new Error("Unidade do contato não pertence à empresa.");
        return {
          tenantId,
          empresaId: empresa.id,
          unidadeId: unidade?.id ?? null,
          tipo: textoObrigatorio(contato.tipo, "Tipo do contato", 40),
          nome: textoObrigatorio(contato.nome, "Nome do contato", 160),
          cargo: contato.cargo?.trim() || null,
          email: contato.email ? normalizarEmailB2B(contato.email) : null,
          telefone: contato.telefone?.replace(/\D/g, "") || null,
          principal: contato.principal ?? false,
        };
      }),
    });
  }

  const centrosPorCodigo = new Map<string, string>();
  for (const item of entrada.centrosCusto) {
    const codigo = referencia(item.codigo, "Código do centro de custo").toUpperCase();
    const centro = await tx.centroCustoB2B.upsert({
      where: { tenantId_empresaId_codigo: { tenantId, empresaId: empresa.id, codigo } },
      create: { tenantId, empresaId: empresa.id, codigo, nome: textoObrigatorio(item.nome, "Nome do centro de custo", 160), orcamentoMensalCentavos: validarOrcamentoB2B(item.orcamentoMensalCentavos), ativo: item.ativo ?? true },
      update: { nome: textoObrigatorio(item.nome, "Nome do centro de custo", 160), orcamentoMensalCentavos: validarOrcamentoB2B(item.orcamentoMensalCentavos), ativo: item.ativo ?? true },
    });
    centrosPorCodigo.set(codigo, centro.id);
  }
  await tx.centroCustoB2B.updateMany({
    where: { tenantId, empresaId: empresa.id, codigo: { notIn: [...centrosPorCodigo.keys()] }, ativo: true },
    data: { ativo: false },
  });

  const compradoresPresentes = new Set<string>();
  for (const item of entrada.compradores) {
    const emailNormalizado = normalizarEmailB2B(item.email);
    compradoresPresentes.add(emailNormalizado);
    const conta = await tx.comprador.findUnique({ where: { tenantId_email: { tenantId, email: emailNormalizado } }, select: { id: true } });
    const vinculo = await tx.compradorEmpresaB2B.upsert({
      where: { tenantId_empresaId_emailNormalizado: { tenantId, empresaId: empresa.id, emailNormalizado } },
      create: { tenantId, empresaId: empresa.id, compradorId: conta?.id, nome: textoObrigatorio(item.nome, "Nome do comprador", 160), emailNormalizado },
      update: { compradorId: conta?.id, nome: textoObrigatorio(item.nome, "Nome do comprador", 160), situacao: "ATIVO" },
      include: { provisionamento: true },
    });
    const autorizacoesResolvidas = item.autorizacoes.map((autorizacao) => {
      const unidade = autorizacao.referenciaUnidade === null ? null : unidadesPorReferencia.get(referencia(autorizacao.referenciaUnidade, "Referência da unidade"));
      if (autorizacao.referenciaUnidade !== null && !unidade) throw new Error("Unidade da autorização não pertence à empresa.");
      return {
        papel: autorizacao.papel,
        unidadeId: unidade?.id ?? null,
        limiteAprovacaoCentavos: autorizacao.limiteAprovacaoCentavos === null ? null : validarOrcamentoB2B(autorizacao.limiteAprovacaoCentavos),
      };
    }).sort((a, b) => `${a.papel}:${a.unidadeId ?? ""}`.localeCompare(`${b.papel}:${b.unidadeId ?? ""}`));
    const intencaoHash = hashIntencao({
      acao: "PROVISIONAR",
      empresa: { razaoSocial, unidades: [...unidadesPorReferencia.entries()].sort(([a], [b]) => a.localeCompare(b)) },
      comprador: { email: emailNormalizado, autorizacoes: autorizacoesResolvidas },
    });
    const novaVersao = Boolean(vinculo.provisionamento && vinculo.provisionamento.intencaoHash !== intencaoHash);
    const versao = vinculo.provisionamento ? vinculo.provisionamento.versaoDesejada + (novaVersao ? 1 : 0) : 1;
    await tx.autorizacaoDesejadaB2B.deleteMany({ where: { tenantId, compradorEmpresaId: vinculo.id, versao } });
    for (const autorizacao of autorizacoesResolvidas) {
      await tx.autorizacaoDesejadaB2B.create({ data: {
        tenantId,
        empresaId: empresa.id,
        compradorEmpresaId: vinculo.id,
        versao,
        papel: autorizacao.papel,
        escopo: autorizacao.unidadeId ? "UNIDADE" : "ORGANIZACAO",
        unidadeId: autorizacao.unidadeId,
        limiteAprovacaoCentavos: autorizacao.limiteAprovacaoCentavos,
      } });
    }
    await tx.provisionamentoCompradorB2B.upsert({
      where: { compradorEmpresaId: vinculo.id },
      create: { tenantId, compradorEmpresaId: vinculo.id, versaoDesejada: versao, correlacaoId: randomUUID(), intencaoHash },
      update: {
        situacao: novaVersao ? "PENDENTE" : undefined,
        versaoDesejada: versao,
        correlacaoId: novaVersao ? randomUUID() : vinculo.provisionamento?.correlacaoId,
        intencaoHash,
        leaseId: novaVersao ? null : undefined,
        ultimoErro: novaVersao ? null : undefined,
      },
    });
    await tx.compradorCentroCustoB2B.deleteMany({ where: { tenantId, compradorEmpresaId: vinculo.id } });
    if (item.centrosCusto.length) {
      await tx.compradorCentroCustoB2B.createMany({ data: item.centrosCusto.map((bruto) => {
        const codigo = referencia(bruto, "Código do centro de custo").toUpperCase();
        const centroCustoId = centrosPorCodigo.get(codigo);
        if (!centroCustoId) throw new Error(`Centro de custo ${codigo} não pertence à empresa.`);
        return { tenantId, empresaId: empresa.id, compradorEmpresaId: vinculo.id, centroCustoId };
      }) });
    }
  }

  const removidos = await tx.compradorEmpresaB2B.findMany({
    where: { tenantId, empresaId: empresa.id, emailNormalizado: { notIn: [...compradoresPresentes] }, situacao: "ATIVO" },
    include: { provisionamento: true },
  });
  for (const removido of removidos) {
    const intencaoHash = hashIntencao({ acao: "SUSPENDER", email: removido.emailNormalizado, empresaId: empresa.id });
    const novaVersao = Boolean(removido.provisionamento && removido.provisionamento.intencaoHash !== intencaoHash);
    const versao = removido.provisionamento ? removido.provisionamento.versaoDesejada + (novaVersao ? 1 : 0) : 1;
    await tx.compradorEmpresaB2B.update({ where: { id: removido.id }, data: { situacao: "SUSPENSO" } });
    await tx.provisionamentoCompradorB2B.upsert({
      where: { compradorEmpresaId: removido.id },
      create: { tenantId, compradorEmpresaId: removido.id, versaoDesejada: versao, correlacaoId: randomUUID(), intencaoHash },
      update: { situacao: novaVersao ? "PENDENTE" : undefined, versaoDesejada: versao, correlacaoId: novaVersao ? randomUUID() : undefined, intencaoHash, leaseId: novaVersao ? null : undefined, ultimoErro: null },
    });
  }

  const posterior = await tx.empresaB2B.findUniqueOrThrow({ where: { id: empresa.id }, include: incluirAgregado });

  await tx.auditoriaB2B.create({ data: {
    tenantId,
    empresaId: empresa.id,
    tipoAtor: textoObrigatorio(ator.tipo, "Tipo do ator", 40),
    atorId: ator.id?.trim() || null,
    atorEmail: ator.email ? normalizarEmailB2B(ator.email) : null,
    acao: anterior ? "EMPRESA_ATUALIZADA" : "EMPRESA_CRIADA",
    entidade: "EmpresaB2B",
    entidadeId: empresa.id,
    resultado: "SUCESSO",
    estadoAnterior: anterior ? JSON.parse(JSON.stringify(anterior)) : Prisma.JsonNull,
    estadoPosterior: JSON.parse(JSON.stringify(posterior)),
  } });
  return empresa;
}

export async function salvarEmpresaB2B(tenantId: string, entrada: EntradaEmpresaB2B, ator: AtorB2B) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      return await prisma.$transaction((tx) => salvarNaTransacao(tx, tenantId, entrada, ator), { isolationLevel: "Serializable" });
    } catch (erro) {
      if (tentativa < 3 && erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034") continue;
      throw erro;
    }
  }
  throw new Error("Não foi possível salvar a empresa.");
}
