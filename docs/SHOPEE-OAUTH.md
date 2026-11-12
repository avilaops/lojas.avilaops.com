# Conectar lojas à Shopee

## Produto e configuração

Cada lojista conecta sua própria conta em **Configurações → Canais → Shopee**.
A plataforma usa um aplicativo da Ávila; o lojista autoriza o acesso na Shopee.
Não há restrição do produto à `demo`: a conexão segue a sessão, a permissão de
configurações e o tenant atual. O sandbox e a demo servem à homologação.

O backend permanece **TypeScript/Next.js**, por decisão do proprietário em
12/11/2026. O provedor já existente foi preservado e suas validações foram
completadas; não há migração do backend para Rust.

A conta de desenvolvedor da Open Platform, a criação/aprovação do app e a
autorização de uma loja são etapas distintas. Código/CI aprovado não comprova
essas etapas. Até a conferência de 12/11, as credenciais não estavam
configuradas e não havia conta Shopee conectada no Lojas.

1. Entrar na [Open Platform](https://open.shopee.com/) e preparar um aplicativo
   apropriado à integração das lojas. O cadastro/aprovação pertence ao titular.
2. Cadastrar o domínio de retorno `lojas.avilaops.com` e a URL de callback
   `https://lojas.avilaops.com/canais/shopee/callback` nos dados do aplicativo.
3. Configurar privadamente `SHOPEE_PARTNER_ID` e `SHOPEE_PARTNER_KEY`, do mesmo
   app e ambiente, no fluxo de configuração/entrega aprovado da aplicação.
   O lojista não recebe nem preenche essa chave do parceiro.
4. Para homologação na demo, usar conta de loja do Sandbox V2 e definir
   `SHOPEE_URL=https://openplatform.sandbox.test-stable.shopee.sg`.
   A autorização passa a usar o sandbox automaticamente.
5. Entrar na loja correta no Lojas e clicar **Conectar** no cartão Shopee.
   Conferir conta/ambiente na página oficial, autorizar e retornar ao Lojas.
6. Confirmar o nome ou identificador da loja conectada. Somente depois
   registrar homologação com data, versão e resultado; ocultar URL assinada,
   códigos, state, cookies e tokens das evidências.

O botão depende da configuração válida do aplicativo e atende os lojistas com
permissão de configurações. Sem ela, a integração permanece indisponível; a
plataforma não apresenta uma conexão que ainda não pode executar.

## Ambientes

| Ambiente | API | Página de autorização padrão BR |
| --- | --- | --- |
| Produção | `https://partner.shopeemobile.com` | `https://open.shopee.com.br/auth` |
| Sandbox | `https://openplatform.sandbox.test-stable.shopee.sg` | `https://open.sandbox.test-stable.shopee.com.br/auth` |

Sem override, a API continua com seu padrão de produção e a autorização é do
mesmo ambiente. `SHOPEE_AUTH_URL` pode selecionar a página global equivalente:
`https://open.shopee.com/auth` ou
`https://open.sandbox.test-stable.shopee.com/auth`. Outros destinos, caminhos,
credenciais na URL, portas não padrão, query/fragmento e ambientes misturados
são recusados antes da chamada. Preparar produção exige credenciais e
aprovação correspondentes; um teste de sandbox não autoriza essa passagem.

## Fluxo implementado

1. `GET /api/painel/canais/shopee` confere sessão e permissão e emite state
   assinado por propósito, tenant e expiração. A autorização recebe parceiro,
   tipo seller, callback, resposta code e state.
2. `GET /canais/shopee/callback` valida state, sessão e tenant antes da troca.
   A Shopee usa seu protocolo de autorização com chamadas HMAC; não exige um
   fluxo genérico com client_secret no corpo.
3. O adaptador troca code/shop_id por tokens. Somente uma resposta HTTP de
   sucesso com objeto válido, tokens textuais não vazios e validade válida
   pode chegar à persistência. As chamadas não usam cache nem seguem redirects.
4. `ContaCanal` guarda tokens cifrados por `(tenantId, canal)`. Nome de loja é
   uma identificação opcional; falha na consulta não invalida tokens válidos.
5. A renovação mantém shop_id e substitui o refresh rotativo. A coordenação
   concorrente existente é por processo; múltiplas réplicas exigem coordenação
   distribuída em outro incremento. Excluir a conexão apaga somente a conta
   do tenant selecionado.

IDs zero, com zeros iniciais ou sem representação numérica exata são
recusados. Validade ausente, inválida, expirada ou maior que quatro horas não
recebe um prazo inventado. Mensagens externas e URLs assinadas não são
propagadas como erros. Autorização por conta principal sem loja escolhida
continua recusada: esta integração associa uma loja Shopee a cada tenant.

Esta etapa conecta contas. Publicação/sincronia de catálogo, pedidos e demais
operações comerciais exigem seus próprios adaptadores e homologação.

## Evidência

Os testes do provedor usam respostas sintéticas, e a integração exercita
cifragem, rotação, isolamento, concorrência e recusa no PostgreSQL da CI. Os
resultados são vinculados ao commit no PR e na AVL-244; não representam uma
conta real autorizada.

Fontes oficiais consultadas em 12/11/2026:

- [Introdução indicada pelo proprietário](https://open.shopee.com/developer-guide/4).
- [Autorização e autenticação](https://open.shopee.com/developer-guide/20).
- [Autorize sua primeira loja](https://open.shopee.com/developer-guide/739).
- [Sandbox V2](https://open.shopee.com/developer-guide/644).
