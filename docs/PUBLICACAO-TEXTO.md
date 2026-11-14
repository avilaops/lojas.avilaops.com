# Publicação pública de Markdown e MDX

## Contrato

As versões textuais usam o HTML público atual do renderizador Next.js e
`@avilaops/publicacao-texto`, fixado no commit
`5d8cf306ceded156ab2a46ce1cfd29608e67496f` de `avilaops/motor-web`.
Não existe uma segunda cópia editorial, migração de backend ou recaptura de
catálogo para gerar cada produto.

O pacote é consumido somente no servidor Node 22. O commit fixado usa o export
nomeado do plugin GFM e uma instância de DOM local ao conversor; não instala
`document` ou `window` globais.

Uma página `/` corresponde a `/index.md` e `/index.mdx`. Uma página
`/produtos/exemplo` corresponde a `/produtos/exemplo/index.md` e
`/produtos/exemplo/index.mdx`. A rota pública, independentemente do canonical
editorial, identifica a representação.

A plataforma inclui home, ajuda, marca, termos comerciais, documentação
pública de desenvolvedores e blog publicado. As lojas incluem home, catálogo,
produto, categoria, páginas institucionais, políticas, promoções, blog e guias
públicos próprios. Páginas públicas de orientação para cotação/configuração
podem oferecer o texto informativo; formulários e ações não são executados ou
publicados como componentes MDX.

Entrar, criar conta/loja, autorizar, painel, conta, pedido, carrinho, checkout,
APIs, comparação personalizada e prévias permanecem fora da exportação.
O mesmo vale para HTML noindex, erro, redirecionamento, conteúdo vazio ou
resposta de autenticação. Slugs inexistentes e rascunhos continuam sujeitos ao
renderizador e aos serviços de publicação existentes.

## Isolamento e leitura

O proxy encaminha as URLs textuais ao manipulador público. O host é validado
e resolvido pelo resolvedor de tenant existente antes de renderizar. A loja
precisa estar publicável e no endereço oficial; a plataforma usa identidade
própria. Separadores codificados, caminhos privados e segmentos ambíguos são
recusados antes da leitura.

O único destino HTTP de renderização é loopback, com porta validada do próprio
processo Next.js. O host público validado acompanha a requisição interna como
identidade de roteamento. Cookies, Authorization, parâmetros de visitante e
outros cabeçalhos recebidos não são encaminhados. Redirecionamentos são
manuais e nunca seguidos para outros destinos.

As respostas textuais e a leitura interna usam `no-store`. A ETag deriva de
tenant, host, rota, formato e conteúdo convertido. Uma requisição condicional
relê a página antes de responder 304; alterar ou remover o conteúdo não mantém
uma exportação antiga. O HTML e suas regras de publicação continuam sendo a
autoridade sobre preço, disponibilidade e acesso.

## Descoberta e indexação

O HTML público anuncia Markdown, MDX e `llms.txt` por HTTP Link. O índice
`llms.txt` acrescenta as versões dos links públicos que ele já publica, sem
nova varredura de catálogo. O sitemap HTML permanece inalterado. As cópias
textuais enviam canonical para o HTML e `X-Robots-Tag: noindex, follow`.

## Verificação e liberação

Build e testes executam somente no GitHub CI. Os testes exercitam proxy e
adaptador reais; o transporte HTML e a resolução externa têm dados controlados
na fronteira para demonstrar isolamento, atualização, remoção, validação de
host, redirects, noindex e respostas de autenticação. Essas provas de CI não
são validação de um backend de produção.

A jornada existente da CI também verifica HTTP no build standalone real,
com duas lojas fictícias e o mesmo slug, atualização, desativação, MIME,
no-store, ETag e descoberta. Ela reutiliza o servidor e o PostgreSQL isolado já
iniciados pelo job; não provisiona serviços nem usa dados de produção.

O inventário de arquivos de página é comparado à classificação de rotas no CI.
Uma nova página precisa ter representação pública ou exclusão operacional
explícita. Categorias e produtos seguem as rotas dinâmicas; obter um arquivo
não executa uma nova enumeração do catálogo.

Esta entrega prepara um PR draft. Merge, deploy, infraestrutura, GA4/GTM,
políticas de cookies e qualquer popup/banner automático ficam fora do escopo.
Após uma liberação futura, conferir URLs reais de pelo menos duas lojas,
alteração e remoção reais, MIME, cabeçalhos e domínio público antes de declarar
a integração ativa. Rollback usa a imagem/commit anterior pelo processo
existente, sob autorização de publicação.
