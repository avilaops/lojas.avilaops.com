# Métricas por loja

`GET /api/admin/metricas` responde, para cada loja, os quatro números que o
operador precisa lado a lado: **latência**, **erros**, **pedidos** e
**conversão**. É a visão da Ávila Ops (n8n ou gente, com `LOJAS_ADMIN_TOKEN`);
o lojista vê os números dele em `/painel/analises` (`docs/ANALYTICS.md`).

São duas fontes, e elas não têm a mesma duração:

| Parte | De onde vem | Janela | Sobrevive ao deploy |
|---|---|---|---|
| `operacao` (latência e erros) | memória do processo (`src/lib/metricas-tenant.ts`) | últimos 1 a 60 minutos (`?minutos=`, padrão 60) | **não** — zera a cada deploy ou reinício |
| `negocio24h` (sessões, pedidos, conversão) | banco (`SessaoVitrine`, `Pedido`) | últimas 24 horas | sim |

`processoDesde` é o instante em que o processo começou a contar. Se ele for
mais recente que a janela pedida, a operação cobre só de lá para cá: poucos
minutos depois de um deploy, "zero erro" quer dizer "zero erro desde o deploy".

## Como chamar

```bash
curl -s -H "authorization: Bearer $LOJAS_ADMIN_TOKEN" \
  "https://lojas.avilaops.com/api/admin/metricas?minutos=15"
```

Sem token ou com token errado: `401`. `minutos` fora de 1 a 60: `400`. A
resposta sai com `cache-control: no-store` e a rota só lê.

```json
{
  "medidoEm": "2026-10-07T15:00:00.000Z",
  "processoDesde": "2026-10-07T11:42:10.512Z",
  "janelaMinutos": 15,
  "lojas": [
    {
      "slug": "demo",
      "nome": "Loja Demo",
      "status": "ATIVA",
      "operacao": {
        "requisicoes": 42,
        "erros": 1,
        "taxaErro": 2.4,
        "porGrupo": {
          "checkout": { "requisicoes": 6, "erros": 1, "p50Ms": 1000, "p95Ms": 2500 },
          "busca": { "requisicoes": 36, "erros": 0, "p50Ms": 50, "p95Ms": 250 }
        }
      },
      "negocio24h": { "sessoes": 120, "pedidosCriados": 9, "pedidosPagos": 6, "conversao": 4.2 }
    }
  ],
  "semLoja": { "requisicoes": 3, "erros": 0, "taxaErro": 0, "porGrupo": { "api-v1": { "requisicoes": 3, "erros": 0, "p50Ms": 25, "p95Ms": 25 } } }
}
```

Entram as lojas `ATIVA` e qualquer outra que teve requisição na janela, em
ordem de slug.

## O que cada número quer dizer

**Requisição.** Uma chamada a uma rota medida (lista abaixo). Página da
vitrine não é requisição medida.

**Erro.** Resposta com status `>= 500`, ou exceção que o Next capturou. `4xx`
conta como requisição e **não** como erro: carrinho inválido, cupom vencido e
chave errada são de quem chamou, não da loja fora do ar.

**`taxaErro`.** `erros / requisicoes`, em percentual com uma casa.

**`p50Ms` e `p95Ms`.** Latência medida no processo, do começo do manipulador
até a resposta. Vem de um histograma de limites fixos
(`25, 50, 100, 250, 500, 1000, 2500, 5000` ms), então o valor é **o limite
superior da faixa onde o percentil caiu**, não a medida exata: `p95Ms: 250`
quer dizer "95% responderam em até 250 ms". Passou de 5000 ms, sai `5000` com
`"acimaDoTeto": true`. Não inclui o tempo de rede nem o do Caddy.

**`sessoes`.** Sessões da vitrine (`SessaoVitrine`) criadas nas últimas 24 h.
Quem recusou o cookie de medição não tem sessão.

**`pedidosCriados`.** Pedidos criados nas últimas 24 h, em qualquer status e
de qualquer canal.

**`pedidosPagos`.** Os que estão em `PAGO`, `EM_SEPARACAO`, `ENVIADO` ou
`ENTREGUE` (`STATUS_VENDA_ANALYTICS`, a mesma régua do painel do lojista).

**`conversao`.** Pedidos pagos **que nasceram numa sessão da vitrine**
(`sessaoId` preenchido), sobre as sessões, em percentual com uma casa. Pedido
de marketplace e compra com cookie recusado contam em `pedidosPagos` e ficam
fora daqui: não passaram por uma sessão medida, e somá-los inflaria a taxa.

**`null` não é zero.** `taxaErro` sem requisição, `conversao` sem sessão e
percentil sem amostra saem `null`: não houve o que medir. Zero quer dizer que
houve e deu zero.

## O que é medido

Os grupos são uma lista fechada (`GRUPOS`):

| Grupo | Rotas | Loja vem de |
|---|---|---|
| `checkout` | `POST /api/checkout`, `GET /api/checkout/status` | host |
| `frete` | `POST /api/frete` | host |
| `busca` | `GET /api/busca` | host |
| `webhook` | `POST /api/webhooks/mercadopago` | `?loja=<slug>` (o webhook pode chegar pelo host da plataforma) |
| `api-v1` | tudo que passa por `rotaDaApi` (`/api/v1/*`) | a chave; sem chave válida vai para `semLoja` |
| `render`, `acao`, `outra` | erro que o Next capturou em página, server action e no resto (`onRequestError`) | host |

`render`, `acao` e `outra` só contam **erro**: o Next avisa quando quebra, não
quando dá certo, então esses grupos não têm latência e a taxa de erro deles
sozinha não quer dizer nada. Erro de rota medida é contado uma vez, no grupo
da rota.

O registro é por host, e a loja é resolvida na leitura: `<slug>.<LOJAS_BASE_DOMAIN>`
pelo slug, o resto por `Tenant.dominios`; `www.` e o domínio sem `www.` somam
na mesma loja. Host que não é de loja nenhuma soma em `semLoja`, sem o nome —
o cabeçalho `Host` pode ser forjado, e por isso o registro guarda no máximo 500
hosts distintos (o excedente também cai em `semLoja`).

Para medir outra rota, envolva o manipulador:

```ts
export const POST = medirRota("frete", async function (request: Request) { ... });
```

## O que não é guardado

O registro recebe quatro campos — host, grupo, status e duração — e a
assinatura de `registrar` não aceita outro. **Não entram:** caminho, query
string (onde moram token de webhook e e-mail de recuperação), cabeçalho,
cookie, `Authorization`, chave de API, IP, user-agent, corpo, nome ou dado de
cliente, nem mensagem de erro. O `onRequestError` lê só o host e o tipo de
rota. Um teste prende isto (`src/lib/metricas-rota.test.ts`): uma chamada de
webhook com token na query, cookie e `Authorization` não deixa nenhum deles no
resumo.

Nada é enviado para fora: não há serviço de métricas de terceiro, nem tabela
nova. A resposta leva slug, nome e status da loja; não leva o id interno.

## O que fica de fora

- **Latência de página** (home, produto, categoria). A fonte certa é o log do
  Caddy (`deploy/Caddyfile.log.snippet`), que tem host, status e duração de
  tudo e mora no servidor, fora do container.
- **Histórico.** Mais de 60 minutos de operação, ou a operação de antes do
  último deploy, não existem. Com mais de uma réplica, cada processo teria o
  seu registro.
- **Alertas** a partir destes números: item de isolamento operacional do
  roadmap.
- Demais rotas (`/api/painel/*`, `/api/conta/*`, `/api/cep`, `/api/cupom`,
  outros webhooks).

## Conferir no servidor local

```bash
npm run banco:teste
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5548/lojas_test
npx tsx --test tests/integration/metricas.test.ts

export LOJAS_SECRET=$(openssl rand -hex 32) LOJAS_BASE_DOMAIN=localhost LOJAS_ADMIN_TOKEN=$(openssl rand -hex 24)
npm run build && npx next start -p 3099 -H 127.0.0.1 &
npm run seed:demo        # grava no DATABASE_URL acima: confira antes que é o :5548/lojas_test
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3099/api/admin/metricas     # 401
curl -s -H "host: demo.localhost" "http://127.0.0.1:3099/api/busca?q=caneca" -o /dev/null
curl -s -H "authorization: Bearer $LOJAS_ADMIN_TOKEN" http://localhost:3099/api/admin/metricas
kill %1; npm run banco:teste:parar
```

A loja `demo` tem de aparecer com `operacao.porGrupo.busca.requisicoes >= 1` e
`p50Ms` numérico.
