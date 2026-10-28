# Continuação dos módulos Lojas no padrão MLOps

Objetivo permanente: desenvolver até o fim de cada módulo, conforme Lojas 360,
sem substituir conclusão funcional por inventários ou CI estrutural verde.

## Situação observada

O PR 178 contém a fundação e o primeiro contrato de payload, com CI aprovada
no HEAD `07ee3d0` (execução `40640930924`). Demais rotas, fluxos funcionais,
integrações e interfaces ainda exigem implementação e evidência próprias.

## Ordem e critérios

1. Fundação: contratos de entrada/saída, identidade, tenant, consumidores e gates.
2. Comércio B2B: catálogo/preço por cliente, cotação, negociação, aprovação,
   pedido, reserva atômica, interface e verificação nas oito dimensões.
3. Fiscal: recebimento e integração com ERP/TMS, sem duplicar autoridade fiscal;
   fontes/referência revisadas antes de qualquer cálculo novo.
4. CMS: contrato de conteúdo/publicação, identidade, tenant, prévia, confirmação
   e reversão sobre o módulo existente, após inspeção do repositório.
5. Expandir o perfil para todas as capacidades do Lojas 360; o recorte atual de
   quatro módulos não reduz o escopo do programa.

## Incremento atual: cotação e pedido

- [x] Inspecionar domínio, handlers, testes, projeções e reserva de estoque.
- [x] Adicionar regressões para projeção privada, concorrência e falha/retry.
- [x] Confirmar regressões na CI antes da correção: `40642109382`, três falhas
  esperadas nos testes novos e 196 integrações preservadas.
- [x] Fazer reserva, pedido e evento na mesma transação.
- [x] Corrigir projeção do comprador, preservar unidade e validar limites monetários.
- [ ] Concluir interface operacional e casos negativos de acesso.
- [ ] Vincular observações reais ao plano MLOps e executar CI.

As correções estão no checkout isolado `lojas-modulos-b2b`, PR 181. A branch
178 e o checkout principal pertencem também a trabalhos concorrentes;
não trocar suas branches nem sobrescrever alterações. CI da correção
`40642521486`: integração aprovada; imagem ainda em execução na observação.

O adaptador de evidências liga quatro checks a testes de domínio/banco:
preço, isolamento, idempotência e releitura da resposta. Interface, HTTP,
reinício e revisão conflitante ainda precisam de cobertura própria.

### Continuação operacional

As telas de cotação do painel e da conta do comprador implementam criação,
contraproposta, submissão, aprovação, recusa, conversão e recompra. As referências
e listas são paginadas e limitadas ao tenant e ao comprador autenticado.
Comandos aceitam revisão esperada e rejeitam conflito dentro da transação.
Erros inesperados têm resposta genérica, sem detalhes internos do banco.

O teste de revisão antiga e submissão expirada falhou como esperado na CI
`40644777671`, no HEAD `1966592`. A correção e as telas aguardam sua própria
CI. A execução `40643539608` aprovou a base anterior: quatro dimensões passaram
e o fluxo permaneceu inconclusivo. Ainda faltam jornada real no navegador,
contrato HTTP e persistência após reinício. A implementação das telas não
constitui evidência de funcionamento dessas dimensões.

### Jornada de navegador e reinício

O runner `scripts/qa-cotacoes-b2b.mts` executa somente na CI, usando PostgreSQL
isolado, Chromium, sessão local de vendedor e login HTTP do comprador. Asserções
de navegador cobrem desktop e celular; HTTP inválido precisa ser recusado antes
de criar uma cotação. O serviço é reiniciado pelo próprio runner, que confere
pedido, versões e histórico em nova requisição e página. Registros MLOps só
são gravados após as asserções correspondentes. Capturas e diagnóstico são
artefatos separados, sem credenciais de produção.

A CI `40649735969` aprovou integração e contratos, com cinco checks reais;
o lint revelou relógio impuro na renderização, corrigido em `18267b1`. As CIs
`40650343283` e `40650960015` reproduziram clique sem abertura do formulário
em Next dev; HTTP de referências funcionou e o navegador registrou falhas de
HMR. Para verificar o artefato entregue, a jornada passou a iniciar o build de
produção, ainda no ambiente isolado. CI `40651466891` está em andamento para
`694b733`. O comportamento da jornada não é declarado corrigido ou aprovado.

Mesmo quando o piloto passar nas oito dimensões, revisar todo o aceite da
AVL-234 e do Lojas 360 antes de concluir o módulo: anexos, centros de custo,
alçadas, exceções comerciais e acesso revogado não podem ficar implícitos no
caminho feliz de um comprador administrador.

Diagnóstico posterior: a CI `40652897431` confirmou `ERR_INVALID_URL` nos
metadados da conta, causado pelo domínio sintético `<slug>.127.0.0.1` da
fixture. O domínio principal da loja de teste passa a ser `localhost`.
O runner inicia `standalone/server.js` com os arquivos estáticos e com
`ROTINAS_AGENDADOR=0`, configuração já suportada, evitando rotinas de fundo
sobre dados dos outros testes. Adição de produtos à contraproposta também
está implementada e coberta pela remoção/reinclusão de item na jornada.

## Limites operacionais

Builds, testes e migrations somente no GitHub CI. Checkouts servem para leitura,
edição e Git. Publicação e efeitos reais externos exigem autorização própria.
Manter PR em rascunho para não acionar merge/deploy automático.
