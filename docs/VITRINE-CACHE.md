# Cache da vitrine: o que é guardado, por quem, e como cai

Estado em 10/09/2026. A vitrine tem três camadas de cache, e nenhuma delas é
requisito para a loja funcionar: sem qualquer uma, a página renderiza igual,
só mais devagar.

## 1. Por requisição (React `cache()`)

`listarCategorias` roda uma vez por requisição, mesmo chamada pelo layout
(menu) e pela página (blocos da home, filtros). Some com a requisição. Nada a
invalidar.

## 2. Por loja, cinco minutos (`unstable_cache`)

| função | o que guarda | por que é caro |
|---|---|---|
| `medidasDaLoja` | faixas de diâmetro/altura do filtro | lê o JSON de atributos de todos os produtos |
| `motosDaLoja` | marcas/modelos do seletor de moto | lê o JSON de compatibilidade de todos os produtos |

Etiqueta `catalogo:<tenantId>`. **Cai antes dos cinco minutos** quando o
catálogo muda: `invalidarCatalogo(tenantId)` é chamado por
`importarProdutos` (planilha), pelo PATCH/DELETE de `/api/painel/produtos` e
pelas ferramentas MCP de criar/atualizar produto. Quem adicionar um caminho
novo de escrita de produto chama a mesma função.

Preço, nome, foto e estoque **não** passam por esta camada: a listagem e a
página do produto leem o banco a cada requisição.

## 3. Na borda (Caddy → CDN), sessenta segundos

Snippet `(lojas_vitrine_cache)` em `/etc/caddy/Caddyfile` (fonte em
`deploy/Caddyfile.vitrine-cache.snippet`), importado no bloco
`*.lojas.avilaops.com` e no bloco gerado por `caddy-sync.sh` para domínios
próprios.

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=600
```

Só quando **todas** valem:

- método `GET`;
- caminho `/`, `/produtos`, `/produtos/*`, `/categoria/*`, `/sobre`,
  `/contato`, `/politicas/*`;
- **sem** cookie `loja_conta` (conta do comprador), `lojas_sessao` (painel)
  ou `minha-moto` (moto escolhida muda a página).

Tudo o mais sai como o Next manda, `private, no-store`: painel, conta,
carrinho, checkout, pedido, login, `/api/*`. O carrinho vive no navegador e
não muda o HTML, por isso não entra na lista de cookies.

O Next **ignora** o `Cache-Control` que o `proxy.ts` tenta pôr em página
dinâmica; é por isso que a regra vive no Caddy. Testar com `GET`, nunca com
`curl -I` (HEAD não casa a regra).

### Com Cloudflare

**Corrigido em 10/09/2026:** só o apex `lojas.avilaops.com` (plataforma e
`/uploads`) passa pelo Cloudflare. `*.lojas.avilaops.com` e os domínios
próprios resolvem **direto** para o Hetzner. Ou seja, hoje **nenhuma
página de loja** tem CDN na frente; o `s-maxage` é emitido para um CDN
futuro. Se um dia os subdomínios ganharem proxy laranja, o Cloudflare **não
guarda HTML por padrão** mesmo com `s-maxage`: precisará de uma Cache Rule
(*hostname termina em `.lojas.avilaops.com` e caminho não começa com
`/painel`, `/conta`, `/carrinho`, `/checkout`, `/pedido`, `/api` → Eligible
for cache, respeitar origin TTL*).

O que o Cloudflare já cacheia hoje: `lojas.avilaops.com/uploads/*` (imagens,
`immutable`, um ano). **Corolário:** quando uma variante de imagem muda de
conteúdo sem mudar de URL (foi o caso das miniaturas `?w=480`, que eram o
original até 10/09), é preciso purge no Cloudflare; a origem não tem como
forçar.

### Sem Cloudflare (toda loja hoje)

Subdomínio e domínio próprio apontam direto para o Caddy, sem proxy laranja. Não há quem
obedeça `s-maxage`: cada requisição chega à origem. O cabeçalho é emitido
mesmo assim, para um CDN futuro ou para o proxy de quem quiser pôr um na
frente. O desempenho ali é o das consultas, e é por isso que a home e a
listagem foram feitas para pedir ao banco só o que mostram.

## Cabeçalhos esperados

| pedido | Cache-Control |
|---|---|
| `GET /` sem cookie | `public, s-maxage=60, stale-while-revalidate=600` |
| `GET /produtos?pagina=3` sem cookie | idem |
| `GET /` com `minha-moto` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `GET /carrinho`, `/checkout`, `/conta`, `/painel` | `private, no-cache, no-store, …` |
| `GET /api/*` | `private, no-store, max-age=0, must-revalidate` |
| `GET /uploads/*` | `public, max-age=31536000, immutable` |

## O que uma alteração no painel leva para aparecer

| mudou | com CDN na frente (não é o caso hoje) | loja hoje (sem CDN) |
|---|---|---|
| preço, nome, foto, estoque | até 60 s (+ uma resposta stale) | imediato |
| categoria, banner, tema | até 60 s | imediato |
| faixa de medidas, motos | imediato (etiqueta) | imediato |

Não aumentar o TTL para esconder consulta lenta: a consulta lenta aparece de
qualquer jeito no domínio próprio.
