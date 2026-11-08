# Vitrine e cotação da Domi-Rio

## Escopo

A composição exclusiva de `domi-rio` usa o catálogo ativo, sem alterar preço,
estoque ou conteúdo técnico. A home contém busca, categorias, seleção de 12
produtos e atendimento empresarial. O conteúdo comercial está em
`src/content/domirio/comercial.mdx`; a ponte dos artigos para atendimento está
em `src/content/domirio/cotar-artigo.mdx`.

`selecionarVitrineDomiRio` considera produtos compráveis com foto e percorre
categorias e famílias antes de repetir apresentações. Conserva a ordem dos
destaques cadastrados dentro dessa diversificação. Não usa faturamento ou
margem e não apresenta os itens como mais vendidos. A consulta está limitada
a 120 candidatos (catálogo conferido: 41 produtos ativos com fotos).

## Ficha e atendimento

As fichas mostram marca, código e apresentação cadastrados. A fonte técnica
verificada da Isorgan ganha link público HTTPS, sem revelar atributos internos.
O formulário permite escolher uma apresentação disponível e quantidade inteira
de 1 a 99999. A mensagem inclui nome, código da variante, apresentação,
quantidade e URL canônica com o identificador da variante. Não reserva saldo,
não concede desconto e não envia uma mensagem automaticamente.

O número é o contato configurado da loja, normalizado pelo contrato existente.
Sem contato válido, a ficha aponta para `/contato`. Quantidade acima do saldo
pode ser consultada; disponibilidade e condições precisam ser confirmadas pelo
comercial. Busca e cotação usam os eventos first-party existentes `search` e
`technical_contact`. Um clique de contato não é contado como venda paga.

Os 50 guias MDX recebem catálogo e atendimento; temas sobre inseticidas e
herbicidas recebem links para categorias ativas pertinentes. O texto distingue
o contexto agrícola dos guias das indicações documentadas dos saneantes.

## Verificação

Revisão visual local em 390 e 1440 px: home, Cypertryne com variantes e Sanepec
simples responderam 200, sem overflow, imagens quebradas ou erros de página.
Simulação de cotação interceptou a navegação para `wa.me`, sem envio: 12 unidades
de Cypertryne 1 L, código ISO015 e URL da variante correta.

Testes de contrato em `src/lib/domirio-comercial.test.ts`: distribuição entre
categorias/famílias, exclusão de itens sem saldo/foto, imutabilidade, mensagem
da variante, validação de quantidade e bloqueio de URLs de fabricante falsas.
Execução de testes e build exclusivamente pela CI conforme AGENTS.md.

Publicação aprovada na [CI 42496618338](https://github.com/avilaops/lojas.avilaops.com/actions/runs/42496618338),
commit edde997. Conferência pública em 08/11/2026: 41 fichas HTTP 200 com
resumo/cotação, 37 com fonte oficial cadastrada, home com seis categorias e
busca, artigo com atendimento. Revisão pública repetida em 390/1440 px sem
overflow, imagens quebradas ou erros de página; cotação pública interceptada
confirmou código ISO015 para Cypertryne 1 L, 12 unidades e URL da variante.

Foi desativada a transformação `email_obfuscation` apenas na zona
domiriodistribuidora.com.br pela API Cloudflare, em 08/11/2026 às 16:05 UTC.
Ela inseria data-cfemail/email-decode no HTML e causava erro React 418 em
produção; ausente localmente. Após desativação, ambos sumiram do HTML e a
revisão pública deixou de registrar o erro. A configuração é reversível
alterando o mesmo parâmetro para on. Referência:
[documentação oficial](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/).

## Próxima medição comercial

Comparar sessões, visualizações de produto, carrinhos, contatos e pedidos pagos
no painel antes/depois. Para priorizar produtos por lucro e abrir campanhas,
levantar margem por SKU, histórico de pedidos e regiões de entrega. Estes dados
não foram presumidos e nenhuma campanha ou orçamento de anúncio foi ativado.
