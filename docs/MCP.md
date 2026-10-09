# Conector MCP da loja

O lojista liga a loja ao assistente dele (Claude, ChatGPT, Codex, Claude Code)
e passa a operar por conversa: cadastrar produto, mexer em preço e estoque, ver
pedido, criar cupom. Recurso do plano Loja Pro.

- Endereço: `https://lojas.avilaops.com/api/mcp`
- Transporte: Streamable HTTP, só requisição e resposta (sem fluxo de eventos).
- Ferramentas: `MCP_TOOLS` em `src/lib/mcp-tools.ts`.

## Três credenciais, uma regra

| | Login (OAuth) | Chave secreta | Chave antiga |
|---|---|---|---|
| Para quem | Lojista, no assistente | n8n, scripts, o que roda sem tela | Quem já tinha |
| Credencial | `lojas_at_…`, vale 1 hora e se renova | `lojas_sk_…` com o escopo `mcp:usar` | `lojas_live_<slug>_…` |
| Onde nasce | Tela `/autorizar`, depois do login no painel | Painel, Chaves da API | Não é mais emitida |
| Guardada como | sha256 (`ConexaoMcp`) | sha256 (`ChaveApi`) | cifrada (`Tenant.apiKeyEnc`) |
| O que pode | O que o lojista marcou na tela | O que os escopos dela dizem | Tudo |
| Desligar | Painel, "Desconectar" | Painel, "Revogar" | Painel, "Revogar" (sem volta) |

As três passam por `autenticarMcp` (`src/lib/mcp-auth.ts`) e pela mesma regra:
loja `ATIVA` e plano `LOJA_PRO`. Rebaixar o plano ou suspender a loja derruba
todas na chamada seguinte.

## O que cada conexão pode

Cada ferramenta exige um escopo (`FERRAMENTAS` em `src/lib/mcp-permissoes.ts`),
e os escopos são os mesmos da API para desenvolvedores (`ESCOPOS` em
`api-chaves.ts`). Ferramenta nova entra em `FERRAMENTAS` no mesmo commit em que
entra em `MCP_TOOLS`; o teste recusa ferramenta sem escopo.

- Na tela `/autorizar` o lojista escolhe: consultar e alterar, só consultar, ou
  por área (loja, catálogo, pedidos, clientes, promoções, análises). O que ele
  marca fica gravado em `ConexaoMcp.escopos`. Depois ele muda em Painel, IA e
  API ("Mudar acesso"), e vale na chamada seguinte. Só o painel muda isso: o
  assistente não amplia o próprio acesso.
- `tools/list` devolve só o que a credencial pode usar, com `annotations`
  (`readOnlyHint`, e `destructiveHint` nas que podem excluir sem volta,
  marcadas com `apaga` em `FERRAMENTAS`) para o assistente saber quando pedir
  confirmação. A privacidade do conector está em `/developers/privacidade`.
  `tools/call` recusa o resto dizendo qual permissão falta.
- Chave secreta só entra no conector com `mcp:usar`. Chave criada para o ERP
  com `catalogo:escrever` não vira chave do conector sozinha.

## Histórico

Cada `tools/call` executado vira uma linha em `ChamadaMcp`: quem (assistente
ou chave), qual ferramenta, se alterou, se deu certo e o identificador do que
foi tocado. **Sem argumentos e sem resultado**: `alvoDaChamada`
(`src/lib/mcp-historico.ts`) só aceita o que parece código (SKU, id, número).
O lojista lê em Painel, IA e API. Retenção de 90 dias, com a faxina feita
quando a lista é aberta.

## Limites e medição

- `/api/mcp`: 120 chamadas por minuto por credencial.
- `/oauth/register`: 10 por minuto por origem e 120 no total.
- `/oauth/token`: 30 por minuto por cliente.
- Tudo entra no grupo `mcp` das métricas (`docs/METRICAS.md`); o login e as
  chamadas sem credencial válida vão para `semLoja`.

O endereço de origem usado no limite do registro vive um minuto na memória do
limitador e não vai para log, métrica nem banco.

## O login, passo a passo

O servidor de autorização somos nós, no domínio-base. Nada aqui conhece um
assistente pelo nome: quem fala MCP com OAuth conecta.

1. O assistente chama `/api/mcp` sem credencial e recebe `401` com
   `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`.
2. Lê `/.well-known/oauth-protected-resource` (RFC 9728) e
   `/.well-known/oauth-authorization-server` (RFC 8414).
3. Registra-se em `POST /oauth/register` (RFC 7591). Cliente público, sem
   segredo. O registro não dá acesso a nada.
4. Abre `GET /oauth/authorize` no navegador do lojista, com PKCE S256. A rota
   confere cliente e retorno, guarda o pedido num cookie assinado
   (`lojas_mcp_pedido`, 10 minutos) e manda para `/autorizar`.
5. `/autorizar` (plataforma) mostra loja, assistente e **para onde o acesso
   vai**. Sem sessão, o lojista passa por `/entrar`; toda porta de login termina
   em `/painel`, e o painel devolve à autorização quando o cookie existe.
6. O lojista escolhe o que o assistente pode e decide em
   `POST /api/painel/mcp/autorizar`. Autorizar exige a permissão
   `configuracoes` (dono ou gerente). Sai um código de 5 minutos.
7. `POST /oauth/token` troca código e `code_verifier` por token de acesso (1 h)
   e de renovação (60 dias, renovados a cada uso).

Rotas de máquina ficam na raiz de `src/app` e estão em `PREFIXOS_DA_RAIZ`
(`src/lib/rotas-da-raiz.ts`); só respondem no domínio-base.

## Regras que não se negociam

- **Erro só é redirecionado depois de conferir o retorno.** Cliente
  desconhecido ou `redirect_uri` fora do registro mostram o erro na nossa tela.
  Redirecionar antes disso é redirecionador aberto com o nosso domínio.
- **Retorno é `https`, ou `http` só na própria máquina** (Codex e Claude Code
  recebem o código numa porta local, que muda a cada login e por isso não entra
  na comparação). `javascript:` e `data:` nunca.
- **PKCE S256 obrigatório.** É o que substitui o segredo do cliente.
- **Código vale uma vez.** Reapresentado depois de gasto, revoga a conexão que
  abriu.
- **Token de renovação muda a cada uso**, com escrita condicional: duas
  renovações simultâneas com o mesmo token rendem um par só.
- **Nada em claro no banco.** Código e tokens só como sha256.
- **O pedido vem do cookie assinado, não do corpo da decisão.** A tela mostrou
  um assistente e um retorno; é para eles que o código vai.
- **Operador desligado derruba a conexão que ele autorizou.**

## O que ainda não tem

- Publicação nos diretórios de conectores do Claude e do ChatGPT.
- Apagar as colunas `Tenant.apiKeyEnc` e `apiKeyCriadaEm`: só depois que as
  lojas com chave antiga migrarem (duas em 08/10/2026).

## Como conferir em produção

```bash
curl -s -o /dev/null -D - -X POST https://lojas.avilaops.com/api/mcp -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

Tem que voltar `401` com `www-authenticate`. Depois:

```bash
curl -s https://lojas.avilaops.com/.well-known/oauth-authorization-server
```

O teste que vale é adicionar o conector num assistente e chegar à tela
`/autorizar`.
