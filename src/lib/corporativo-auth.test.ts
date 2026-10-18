import assert from "node:assert/strict";
import test from "node:test";
import {
  configCorporativoAuth,
  consultarContextosCorporativos,
  lerContextoCorporativo,
  lerRespostaProvisionamento,
  montarPedidoProvisionamento,
  provisionarNoAuth,
  referenciaAuthDaEmpresa,
  referenciaAuthDaUnidade,
  suspenderOuRevogarNoAuth,
} from "./corporativo-auth";

const cfg = configCorporativoAuth({
  SSO_APP_ID: "lojas-avilaops-com",
  AUTH_CLIENT_ID: "lojas",
  AUTH_CLIENT_SECRET: "segredo",
});

test("cliente HTTP valida status e contrato sem vazar credenciais", async () => {
  assert.ok(cfg);
  const chamadas: Array<{ url: string; init?: RequestInit }> = [];
  const fetchOk: typeof fetch = async (input, init) => {
    chamadas.push({ url: String(input), init });
    return Response.json({ contrato: "avila.corporativo.v2", organizacaoId: "org-1", vinculoId: "vinc-1", versao: 4, intencaoVersaoAplicada: 7, organizacaoVersaoAplicada: 11 });
  };
  const resposta = await provisionarNoAuth(cfg!, { versao: "avila.corporativo.v1" }, { fetchImpl: fetchOk, timeoutMs: 100 });
  assert.deepEqual(resposta, { organizacaoId: "org-1", vinculoId: "vinc-1", versao: 4, intencaoVersaoAplicada: 7, organizacaoVersaoAplicada: 11 });
  assert.equal(chamadas[0].init?.method, "POST");
  assert.equal(new Headers(chamadas[0].init?.headers).get("authorization"), cfg!.autorizacao);

  const fetchErro: typeof fetch = async () => new Response("segredo interno", { status: 502 });
  await assert.rejects(
    provisionarNoAuth(cfg!, {}, { fetchImpl: fetchErro, timeoutMs: 100 }),
    (erro: Error) => erro.message === "Auth recusou o provisionamento (502)." && !erro.message.includes("segredo interno"),
  );
  const fetchContratoRuim: typeof fetch = async () => Response.json({ contrato: "outro" });
  await assert.rejects(provisionarNoAuth(cfg!, {}, { fetchImpl: fetchContratoRuim, timeoutMs: 100 }), /resposta inválida/i);
});

test("cliente HTTP suspende com query codificada e consulta contexto com bearer", async () => {
  assert.ok(cfg);
  const chamadas: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    chamadas.push({ url: String(input), init });
    return chamadas.length === 1
      ? Response.json({ contrato: "avila.corporativo.v2", intencaoVersaoAplicada: 7 })
      : Response.json({ contrato: "avila.corporativo.v1", contextos: [] });
  };
  await suspenderOuRevogarNoAuth(cfg!, {
    email: "compras+sp@empresa.test",
    referenciaOrganizacao: "lojas:tenant:empresa:1",
    situacao: "SUSPENSO",
    intencaoVersao: 7,
  }, { fetchImpl, timeoutMs: 100 });
  const url = new URL(chamadas[0].url);
  assert.deepEqual([url.searchParams.get("email"), url.searchParams.get("organizacao"), url.searchParams.get("situacao"), url.searchParams.get("contrato"), url.searchParams.get("intencaoVersao")], [
    "compras+sp@empresa.test", "lojas:tenant:empresa:1", "SUSPENSO", "avila.corporativo.v2", "7",
  ]);
  assert.equal(chamadas[0].init?.method, "DELETE");

  assert.deepEqual(await consultarContextosCorporativos(cfg!, "access-token", { fetchImpl, timeoutMs: 100 }), {
    contrato: "avila.corporativo.v1", contextos: [],
  });
  assert.equal(new Headers(chamadas[1].init?.headers).get("authorization"), "Bearer access-token");
});

test("referências do Auth incluem tenant e id local para não colidir entre lojas", () => {
  assert.equal(referenciaAuthDaEmpresa("tenant-a", "empresa-1"), "lojas:tenant-a:empresa:empresa-1");
  assert.equal(referenciaAuthDaUnidade("tenant-b", "unidade-2"), "lojas:tenant-b:unidade:unidade-2");
  assert.throws(() => referenciaAuthDaEmpresa("tenant com espaço", "empresa-1"), /identificador inválido/i);
});

test("configuração usa a credencial de sistema e os endpoints corporativos", () => {
  assert.deepEqual(cfg, {
    provisionamentoUrl: "https://auth.avilaops.com/api/provisionamento/corporativo",
    contextosUrl: "https://auth.avilaops.com/api/corporativo/contextos",
    autorizacao: `Basic ${Buffer.from("lojas:segredo").toString("base64")}`,
  });
  assert.equal(configCorporativoAuth({ SSO_APP_ID: "lojas-avilaops-com" }), null);
});

test("pedido envia o conjunto completo, incluindo escopo da organização e da unidade", () => {
  assert.deepEqual(montarPedidoProvisionamento({
    intencaoVersao: 7,
    organizacaoVersao: 11,
    tenantId: "tenant-a",
    empresaId: "empresa-1",
    razaoSocial: "Indústria Aurora",
    email: " Compras@Aurora.test ",
    convidadoPor: "dono@aurora.test",
    unidades: [{ id: "unidade-1", nome: "Matriz" }],
    autorizacoes: [
      { papel: "ADMINISTRADOR", unidadeId: null, limiteAprovacaoCentavos: null },
      { papel: "APROVADOR", unidadeId: "unidade-1", limiteAprovacaoCentavos: 150_000 },
    ],
  }), {
    versao: "avila.corporativo.v2",
    intencaoVersao: 7,
    organizacaoVersao: 11,
    email: "compras@aurora.test",
    organizacao: { referencia: "lojas:tenant-a:empresa:empresa-1", nome: "Indústria Aurora" },
    unidades: [{ referencia: "lojas:tenant-a:unidade:unidade-1", nome: "Matriz" }],
    autorizacoes: [
      { papel: "ADMINISTRADOR", referenciaUnidade: null, limiteAprovacaoCentavos: null },
      { papel: "APROVADOR", referenciaUnidade: "lojas:tenant-a:unidade:unidade-1", limiteAprovacaoCentavos: 150_000 },
    ],
    convidadoPor: "dono@aurora.test",
  });
});

test("resposta de provisionamento só aceita o contrato, IDs e versão da intenção", () => {
  assert.deepEqual(lerRespostaProvisionamento({ contrato: "avila.corporativo.v2", organizacaoId: "org-1", vinculoId: "vinc-1", versao: 2, intencaoVersaoAplicada: 7, organizacaoVersaoAplicada: 11 }), {
    organizacaoId: "org-1", vinculoId: "vinc-1", versao: 2, intencaoVersaoAplicada: 7, organizacaoVersaoAplicada: 11,
  });
  assert.equal(lerRespostaProvisionamento({ contrato: "avila.corporativo.v1", organizacaoId: "org-1", vinculoId: "vinc-1", versao: 2, intencaoVersaoAplicada: 7, organizacaoVersaoAplicada: 11 }), null);
  assert.equal(lerRespostaProvisionamento({ contrato: "avila.corporativo.v2", organizacaoId: "org-1", vinculoId: "", versao: 2, intencaoVersaoAplicada: 7, organizacaoVersaoAplicada: 11 }), null);
  assert.equal(lerRespostaProvisionamento({ contrato: "avila.corporativo.v2", organizacaoId: "org-1", vinculoId: "vinc-1", versao: 2 }), null);
});

test("contexto trata autorizações organizacionais e por unidade e fecha em referência desconhecida", () => {
  const corpo = {
    contrato: "avila.corporativo.v1",
    contextos: [{
      contrato: "avila.corporativo.v1",
      organizacaoId: "org-1",
      vinculoId: "vinc-1",
      referenciaExterna: "lojas:tenant-a:empresa:empresa-1",
      nome: "Aurora",
      versao: 3,
      autorizacoesOrganizacao: [{ papel: "COMPRADOR", limiteAprovacaoCentavos: null }],
      unidades: [{
        id: "auth-unidade-1",
        referenciaExterna: "lojas:tenant-a:unidade:unidade-1",
        nome: "Matriz",
        autorizacoes: [{ papel: "APROVADOR", limiteAprovacaoCentavos: 200_000 }],
      }],
    }],
  };
  assert.deepEqual(lerContextoCorporativo(corpo, {
    referenciaOrganizacao: "lojas:tenant-a:empresa:empresa-1",
    unidades: new Map([["lojas:tenant-a:unidade:unidade-1", "unidade-1"]]),
  }), {
    organizacaoId: "org-1",
    vinculoId: "vinc-1",
    versao: 3,
    escopos: [
      { papel: "COMPRADOR", unidadeId: null, authUnidadeId: null, limiteAprovacaoCentavos: null },
      { papel: "APROVADOR", unidadeId: "unidade-1", authUnidadeId: "auth-unidade-1", limiteAprovacaoCentavos: 200_000 },
    ],
  });
  corpo.contextos[0].unidades[0].referenciaExterna = "lojas:outro:unidade:x";
  assert.equal(lerContextoCorporativo(corpo, {
    referenciaOrganizacao: "lojas:tenant-a:empresa:empresa-1",
    unidades: new Map([["lojas:tenant-a:unidade:unidade-1", "unidade-1"]]),
  }), null);
});
