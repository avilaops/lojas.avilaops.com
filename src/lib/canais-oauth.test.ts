import assert from "node:assert/strict";
import test from "node:test";
import { amazon } from "./canal-amazon";
import { contaDoToken, magalu } from "./canal-magalu";
import { assinar, shopee, validadeEmSegundos } from "./canal-shopee";

/**
 * O contrato de autorização de cada marketplace, sem rede.
 *
 * O que se trava aqui é o que sai da plataforma para o canal — endereço,
 * assinatura, nome de cada campo — e a leitura do que volta. Errar um nome de
 * parâmetro não quebra build nenhum: só aparece para o lojista, como uma tela
 * de erro do canal que parece defeito da loja dele.
 */

const RETORNO = "https://lojas.avilaops.com/canais";

/** Troca o ambiente e o `fetch` pelo tempo de um teste, e devolve tudo depois. */
async function com<T>(
  ambiente: Record<string, string | undefined>,
  respostas: unknown[],
  corpo: (chamadas: Array<{ url: URL; init: RequestInit }>) => Promise<T> | T,
): Promise<T> {
  const antes = Object.fromEntries(Object.keys(ambiente).map((k) => [k, process.env[k]]));
  const fetchAntes = globalThis.fetch;
  const chamadas: Array<{ url: URL; init: RequestInit }> = [];
  for (const [k, v] of Object.entries(ambiente)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    chamadas.push({ url: new URL(String(url)), init: init ?? {} });
    return Response.json(respostas[chamadas.length - 1] ?? {});
  }) as typeof fetch;
  try {
    return await corpo(chamadas);
  } finally {
    globalThis.fetch = fetchAntes;
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const json = (init: RequestInit) => JSON.parse(String(init.body)) as Record<string, unknown>;
const form = (init: RequestInit) => Object.fromEntries(new URLSearchParams(String(init.body)));

// ── Shopee ─────────────────────────────────────────────────────────────

const SHOPEE = { SHOPEE_PARTNER_ID: "2001887", SHOPEE_PARTNER_KEY: "chave-de-teste", SHOPEE_URL: undefined, SHOPEE_AUTH_URL: undefined };

test("Shopee: a assinatura é HMAC-SHA256 em hex de parceiro, caminho e hora", async () => {
  // Os dois valores foram calculados fora deste código, com a mesma chave.
  await com(SHOPEE, [], () => {
    assert.equal(assinar("/api/v2/shop/auth_partner", 1_700_000_000), "d88156bd7fafc16c2798812164787603a320a430af457f7d34e2743300a83e13");
    assert.equal(
      assinar("/api/v2/shop/get_shop_info", 1_700_000_000, { accessToken: "token-abc", shopId: "778899" }),
      "009e0050687732907b764f575a5786a317a626f53d1ccd4572e5a3d4ed88dfad",
      "chamada em nome da loja acrescenta o token e o código dela",
    );
  });
});

test("Shopee: a autorização é na página do Brasil, como loja, e leva o state", async () => {
  await com(SHOPEE, [], () => {
    const url = new URL(shopee.urlDeAutorizacao("corpo.assinatura", `${RETORNO}/shopee/callback`));
    assert.equal(url.origin + url.pathname, "https://open.shopee.com.br/auth");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      partner_id: "2001887",
      auth_type: "seller",
      redirect_uri: `${RETORNO}/shopee/callback`,
      response_type: "code",
      state: "corpo.assinatura",
    });
    // O link de autorização não é assinado: assinatura é das chamadas de API.
    assert.equal(url.searchParams.get("sign"), null);
  });
});

test("Shopee: o ambiente de testes troca a página de autorização e o host da API", async () => {
  const sandbox = { ...SHOPEE, SHOPEE_AUTH_URL: "https://open.sandbox.test-stable.shopee.com.br/auth", SHOPEE_URL: "https://openplatform.sandbox.test-stable.shopee.sg/" };
  await com(sandbox, [{ access_token: "a", refresh_token: "r", expire_in: 14_400 }], async (chamadas) => {
    assert.ok(shopee.urlDeAutorizacao("s", `${RETORNO}/shopee/callback`).startsWith("https://open.sandbox.test-stable.shopee.com.br/auth?"));
    await shopee.renovar("r0", "778899");
    assert.equal(chamadas[0].url.origin, "https://openplatform.sandbox.test-stable.shopee.sg");
  });
});

test("Shopee: validade que vier como data não vira acesso de cinquenta anos", () => {
  const agora = 1_767_000_000;
  assert.equal(validadeEmSegundos(14_400, agora), 14_400, "segundos, como o guia descreve");
  assert.equal(validadeEmSegundos(agora + 14_400, agora), 14_400, "data, como o exemplo da referência mostra");
  assert.equal(validadeEmSegundos(agora - 10, agora), 4 * 3600, "data no passado cai no prazo do contrato");
  assert.equal(validadeEmSegundos(undefined, agora), 4 * 3600);
});

test("Shopee: troca o código mandando parceiro e loja como número, e guarda o código da loja", async () => {
  const respostas = [
    { access_token: "acesso", refresh_token: "refresh", expire_in: 14_400, error: "", message: "" },
    { shop_name: "Brilhax Oficial", region: "BR" },
  ];
  await com(SHOPEE, respostas, async (chamadas) => {
    const t = await shopee.trocarCodigo(new URLSearchParams({ code: "abc", shop_id: "778899", state: "x" }), `${RETORNO}/shopee/callback`);
    assert.deepEqual(t, {
      accessToken: "acesso",
      refreshToken: "refresh",
      expiraEmSegundos: 14_400,
      refreshExpiraEmSegundos: 30 * 86_400,
      contaId: "778899",
      contaNome: "Brilhax Oficial",
    });
    assert.equal(chamadas[0].url.pathname, "/api/v2/auth/token/get");
    assert.deepEqual(json(chamadas[0].init), { code: "abc", shop_id: 778899, partner_id: 2001887 });
    assert.equal(chamadas[1].url.pathname, "/api/v2/shop/get_shop_info");
    assert.equal(chamadas[1].url.searchParams.get("access_token"), "acesso");
    assert.equal(chamadas[1].url.searchParams.get("shop_id"), "778899");
  });
});

test("Shopee: erro no corpo da resposta não vira conexão", async () => {
  // A Shopee responde 200 com `error` preenchido, e às vezes ainda com um token velho.
  await com(SHOPEE, [{ error: "error_auth", message: "Invalid code" }], async () => {
    await assert.rejects(
      shopee.trocarCodigo(new URLSearchParams({ code: "abc", shop_id: "778899" }), `${RETORNO}/shopee/callback`),
      /Invalid code/,
    );
  });
});

test("Shopee: conta principal sem loja escolhida é recusada antes de ir à rede", async () => {
  await com(SHOPEE, [], async (chamadas) => {
    await assert.rejects(
      shopee.trocarCodigo(new URLSearchParams({ code: "abc", main_account_id: "55" }), `${RETORNO}/shopee/callback`),
      /conta principal/,
    );
    assert.equal(chamadas.length, 0);
  });
});

test("Shopee: a renovação exige o código da loja e devolve o refresh novo", async () => {
  await com(SHOPEE, [{ access_token: "acesso-2", refresh_token: "refresh-2", expire_in: 14_400 }], async (chamadas) => {
    await assert.rejects(shopee.renovar("refresh-1", null), /código da loja/);
    assert.equal(chamadas.length, 0);

    const t = await shopee.renovar("refresh-1", "778899");
    assert.equal(t.refreshToken, "refresh-2", "o refresh é de uso único");
    assert.equal(chamadas[0].url.pathname, "/api/v2/auth/access_token/get");
    assert.deepEqual(json(chamadas[0].init), { refresh_token: "refresh-1", shop_id: 778899, partner_id: 2001887 });
  });
});

test("Shopee: sem parceiro cadastrado o canal não está disponível", async () => {
  await com({ SHOPEE_PARTNER_ID: undefined, SHOPEE_PARTNER_KEY: undefined }, [], () => assert.equal(shopee.configurado(), false));
  await com({ SHOPEE_PARTNER_ID: "abc", SHOPEE_PARTNER_KEY: "x" }, [], () => assert.equal(shopee.configurado(), false, "o id do parceiro é número"));
  await com(SHOPEE, [], () => assert.equal(shopee.configurado(), true));
});

// ── Amazon ─────────────────────────────────────────────────────────────

const AMAZON = {
  AMAZON_APP_ID: "amzn1.sellerapps.app.teste",
  AMAZON_CLIENT_ID: "amzn1.application-oa2-client.teste",
  AMAZON_CLIENT_SECRET: "segredo",
  AMAZON_APP_RASCUNHO: undefined,
  AMAZON_SELLER_CENTRAL_URL: undefined,
};

test("Amazon: a autorização identifica o aplicativo pelo application id, no Seller Central do Brasil", async () => {
  await com(AMAZON, [], () => {
    const url = new URL(amazon.urlDeAutorizacao("corpo.assinatura", `${RETORNO}/amazon/callback`));
    assert.equal(url.origin + url.pathname, "https://sellercentral.amazon.com.br/apps/authorize/consent");
    // Só o aplicativo e o state: `client_id` e `redirect_uri` entram na troca
    // do código, e a Amazon volta para o retorno registrado no aplicativo.
    assert.deepEqual(Object.fromEntries(url.searchParams), { application_id: "amzn1.sellerapps.app.teste", state: "corpo.assinatura" });
  });
});

test("Amazon: aplicativo em rascunho autoriza com version=beta", async () => {
  await com({ ...AMAZON, AMAZON_APP_RASCUNHO: "1" }, [], () => {
    const url = new URL(amazon.urlDeAutorizacao("s", `${RETORNO}/amazon/callback`));
    assert.equal(url.searchParams.get("version"), "beta");
  });
});

test("Amazon: o código volta em spapi_oauth_code e é trocado em formulário", async () => {
  const respostas = [
    { access_token: "Atza|acesso", refresh_token: "Atzr|refresh", expires_in: 3600, token_type: "bearer" },
    { payload: [{ marketplace: { countryCode: "US" }, storeName: "Outra" }, { marketplace: { countryCode: "BR" }, storeName: "VedaShow" }] },
  ];
  await com(AMAZON, respostas, async (chamadas) => {
    const retorno = new URLSearchParams({ spapi_oauth_code: "codigo", selling_partner_id: "A1B2C3", state: "x" });
    const t = await amazon.trocarCodigo(retorno, `${RETORNO}/amazon/callback`);
    assert.deepEqual(t, {
      accessToken: "Atza|acesso",
      refreshToken: "Atzr|refresh",
      expiraEmSegundos: 3600,
      refreshExpiraEmSegundos: 365 * 86_400,
      contaId: "A1B2C3",
      contaNome: "VedaShow",
    });
    assert.equal(String(chamadas[0].url), "https://api.amazon.com/auth/o2/token");
    assert.deepEqual(form(chamadas[0].init), {
      client_id: "amzn1.application-oa2-client.teste",
      client_secret: "segredo",
      grant_type: "authorization_code",
      code: "codigo",
      redirect_uri: `${RETORNO}/amazon/callback`,
    });
    assert.equal(String(chamadas[1].url), "https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations");
    const cabecalhos = new Headers(chamadas[1].init.headers);
    assert.equal(cabecalhos.get("x-amz-access-token"), "Atza|acesso");
    assert.ok(cabecalhos.get("user-agent"), "a SP-API recusa chamada sem user-agent");
  });
});

test("Amazon: `code` comum não é aceito no lugar de spapi_oauth_code", async () => {
  await com(AMAZON, [], async (chamadas) => {
    await assert.rejects(amazon.trocarCodigo(new URLSearchParams({ code: "codigo" }), `${RETORNO}/amazon/callback`), /código de autorização/);
    assert.equal(chamadas.length, 0);
  });
});

test("Amazon: a renovação mantém o refresh guardado, que não é trocado", async () => {
  await com(AMAZON, [{ access_token: "Atza|novo", expires_in: 3600 }], async (chamadas) => {
    const t = await amazon.renovar("Atzr|refresh", "A1B2C3");
    assert.equal(t.accessToken, "Atza|novo");
    assert.equal(t.refreshToken, "Atzr|refresh");
    assert.equal(form(chamadas[0].init).grant_type, "refresh_token");
  });
});

test("Amazon: erro do Login with Amazon chega com o motivo", async () => {
  await com(AMAZON, [{ error: "invalid_grant", error_description: "The request has an invalid grant parameter : code" }], async () => {
    await assert.rejects(
      amazon.trocarCodigo(new URLSearchParams({ spapi_oauth_code: "velho" }), `${RETORNO}/amazon/callback`),
      /invalid grant parameter/,
    );
  });
});

// ── Magalu ─────────────────────────────────────────────────────────────

const MAGALU = { MAGALU_CLIENT_ID: "cliente", MAGALU_CLIENT_SECRET: "segredo", MAGALU_ESCOPOS: undefined };

/** Um JWT de mentira: só o corpo importa, a assinatura não é conferida. */
const jwt = (corpo: Record<string, unknown>) => `cabecalho.${Buffer.from(JSON.stringify(corpo)).toString("base64url")}.assinatura`;

test("Magalu: a autorização pede os escopos de venda e a escolha da conta", async () => {
  await com(MAGALU, [], () => {
    const url = new URL(magalu.urlDeAutorizacao("corpo.assinatura", `${RETORNO}/magalu/callback`));
    assert.equal(url.origin + url.pathname, "https://id.magalu.com/login");
    assert.equal(url.searchParams.get("client_id"), "cliente");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("choose_tenants"), "true");
    assert.equal(url.searchParams.get("state"), "corpo.assinatura");
    assert.equal(url.searchParams.get("redirect_uri"), `${RETORNO}/magalu/callback`);
    const escopos = (url.searchParams.get("scope") ?? "").split(" ");
    // Escopo não cresce depois: o que a venda vai precisar tem de sair agora.
    assert.ok(escopos.some((e) => e.includes("portfolio")), "catálogo");
    assert.ok(escopos.some((e) => e.includes("order")), "pedido");
  });
});

test("Magalu: MAGALU_ESCOPOS substitui a lista padrão", async () => {
  await com({ ...MAGALU, MAGALU_ESCOPOS: "open:portfolio-skus-seller:read" }, [], () => {
    const url = new URL(magalu.urlDeAutorizacao("s", `${RETORNO}/magalu/callback`));
    assert.equal(url.searchParams.get("scope"), "open:portfolio-skus-seller:read");
  });
});

test("Magalu: troca o código em JSON e pergunta ao Magalu de quem é a loja", async () => {
  const respostas = [
    { access_token: "acesso", refresh_token: "refresh", expires_in: 7200 },
    { tenant: { id: "tenant-123" }, channel: { name: "Magalu" }, seller: { id: "seller-9", name: "Brasa Mineira" } },
  ];
  await com(MAGALU, respostas, async (chamadas) => {
    const t = await magalu.trocarCodigo(new URLSearchParams({ code: "codigo", state: "x" }), `${RETORNO}/magalu/callback`);
    assert.equal(t.contaId, "seller-9");
    assert.equal(t.contaNome, "Brasa Mineira");
    assert.equal(t.expiraEmSegundos, 7200);
    assert.equal(String(chamadas[1].url), "https://api.magalu.com/seller/v1/portfolios/me");
    assert.equal(new Headers(chamadas[1].init.headers).get("authorization"), "Bearer acesso");
    assert.equal(String(chamadas[0].url), "https://id.magalu.com/oauth/token");
    assert.deepEqual(json(chamadas[0].init), {
      client_id: "cliente",
      client_secret: "segredo",
      grant_type: "authorization_code",
      code: "codigo",
      redirect_uri: `${RETORNO}/magalu/callback`,
    });
  });
});

test("Magalu: sem a consulta da loja, o rótulo sai do próprio token", async () => {
  const acesso = jwt({ tenant: "tenant-123", email: "loja@exemplo.com.br" });
  // A segunda resposta é vazia: a consulta da loja não devolveu nada.
  await com(MAGALU, [{ access_token: acesso, refresh_token: "refresh", expires_in: 7200 }, {}], async () => {
    const t = await magalu.trocarCodigo(new URLSearchParams({ code: "codigo" }), `${RETORNO}/magalu/callback`);
    assert.equal(t.contaId, "tenant-123");
    assert.equal(t.contaNome, "loja@exemplo.com.br");
  });
});

test("Magalu: token que não é JWT conecta do mesmo jeito, só sem rótulo", () => {
  assert.deepEqual(contaDoToken("token-opaco"), { id: null, nome: null });
  assert.deepEqual(contaDoToken(""), { id: null, nome: null });
});

test("Magalu: a renovação vai em formulário e guarda o refresh que vier", async () => {
  await com(MAGALU, [{ access_token: "a2", refresh_token: "r2", expires_in: 7200 }, { access_token: "a3", expires_in: 7200 }], async (chamadas) => {
    const t = await magalu.renovar("r1", null);
    assert.equal(t.refreshToken, "r2");
    // A troca do código é JSON; a renovação, no mesmo endereço, é formulário.
    assert.equal(new Headers(chamadas[0].init.headers).get("content-type"), "application/x-www-form-urlencoded");
    assert.deepEqual(form(chamadas[0].init), { client_id: "cliente", client_secret: "segredo", grant_type: "refresh_token", refresh_token: "r1" });

    const semRefresh = await magalu.renovar("r2", null);
    assert.equal(semRefresh.refreshToken, "r2", "sem refresh novo, o guardado continua valendo");
  });
});

test("recusa do lojista é lida do retorno de quem tem esse retorno", () => {
  const recusa = new URLSearchParams({ error: "access_denied" });
  assert.equal(amazon.recusou(recusa), true);
  assert.equal(magalu.recusou(recusa), true);
  assert.equal(amazon.recusou(new URLSearchParams({ spapi_oauth_code: "x" })), false);
  // Na Shopee quem desiste não volta: não há recusa para ler.
  assert.equal(shopee.recusou(recusa), false);
});
