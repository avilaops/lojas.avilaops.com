# Auditoria padrão das lojas

Versão 1.0.0. Escopo: todas as lojas da plataforma Ávila Lojas. Mudanças na loja continuam sujeitas à revisão; auditoria não publica correções.

## Executar a coleta técnica

```powershell
node scripts/auditoria/executar.mjs scripts/auditoria/lojas.json D:\Projetos\outputs\auditorias-padronizadas
npm run test:auditoria
node scripts/auditoria/gerar-n8n.mjs
```

`lojas.json` é o manifesto explícito de domínios autorizados. Inclui apenas a PK como validação inicial; não representa a lista completa das lojas. Para cada loja, informar slug, URL, segmento e objetivo comercial. Objetivo pode ser `compra-online`, `pedido-assistido` ou `nao-definido`; não inferir o objetivo pela ausência de checkout.

Saída: pasta por execução com JSON e Markdown por loja e índice consolidado. Limite atual: quatro recursos públicos e os primeiros três produtos do sitemap. Falhas em uma loja não encerram a coleta das demais. Não é varredura individual de todo produto.

Exit codes: 0 sem falha/bloqueio nos testes automáticos; 1 com falhas ou bloqueios de coleta; 2 configuração/execução inválida. **Exit 0 não significa loja pronta para vender**: revisões não realizadas permanecem `NAO_TESTADO`, e prontidão comercial permanece `NAO_CERTIFICADA`.

O coletor aceita apenas HTTPS público, recusa credenciais na URL e destinos locais, não segue redirects e limita corpo a 5 MB e coleta a 20 segundos por requisição. A validação DNS reduz acessos acidentais à rede local, mas não é proteção contra DNS rebinding em serviço multiusuário: o manifesto deve ser revisado e este CLI não deve ser exposto como executor público de URLs arbitrárias.

## Contrato de toda análise

Cada verificação registra `id`, `estado`, `prioridade`, `url`, `esperado` e `observado`. O relatório identifica versão do protocolo, data, loja, objetivo e segmento. Captura precisa de arquivo, URL, viewport e data; se falhar, registrar bloqueio, sem inventar evidência.

Estados: `PASSOU`, `FALHOU`, `BLOQUEADO`, `NAO_TESTADO`. Hipóteses são registradas separadamente no relatório humano. Não converter falta de acesso em sucesso ou ausência de funcionalidade.

Prioridades: P0 impede o objetivo comercial confirmado; P1 afeta escolha, operação ou confiança; P2 melhora clareza, aquisição ou desempenho. Catálogo assistido não é defeito por não ter checkout; comparar sempre com o objetivo aprovado.

## Etapas obrigatórias por loja

1. Identificar domínio, tenant, segmento e objetivo comercial.
2. Confirmar cada acesso com consulta mínima. Registrar leitura, escrita demonstrada, limites e falhas. Não usar uma escrita apenas para provar permissão.
3. Coletar HTTP, SEO e amostra de catálogo com este script; guardar JSON e Markdown.
4. Navegar desktop e mobile: home, menu, categoria, busca, produto, carrinho, contato e políticas. Usar navegador autorizado e capturas reais.
5. Testar busca com nome, SKU, acento, decimal ponto/vírgula, entrada parcial, nenhum resultado, entrada inválida, filtros e limpeza. Registrar valores usados e IDs retornados.
6. Conferir produto: foto, descrição, preço, estoque anunciado, unidade de venda, variações, campos técnicos e compatibilidade por fonte aprovada.
7. Testar carrinho de forma reversível: adicionar, aumentar/reduzir, mínimo, subtotal, persistência e remoção. Não enviar pedido, pagar ou acionar cliente.
8. Se houver login, comparar painel e vitrine por SKU: preço, estoque, disponibilidade, pedidos, promoções, avaliações, marketing, IA/API, publicação, entrega e recebimento. Não exportar dados pessoais ou segredos.
9. Medir desempenho de navegador com condições e repetições registradas. Latência HTTP não é LCP, INP ou CLS. Declarar amostra e ausência de dados de campo.
10. Produzir diagnóstico, evidências, testes esperado/observado, pauta de fotos, propostas concretas, ordem de execução e dependências. Comparar com a execução anterior sem apagar originais.

## Módulos de segmento

| Segmento | Complemento obrigatório |
| --- | --- |
| Vedações | DI, DE, altura, mm/pol, material, perfil, aplicação, referência; margem de busca não é compatibilidade; testar fronteiras e erro por campo |
| Autopeças/motopeças | Marca/modelo/ano, código original e fonte de equivalência; não inferir encaixe por nome |
| Moda | Grade, estoque por variação, fotos por cor e tabela de medidas |
| Alimentos | Unidade/peso, composição e informações aprovadas; entrega/retirada e conservação |
| Cosméticos | Volume, composição/orientações aprovadas, variações e identificação |
| Demais | Definir atributos técnicos indispensáveis com o catálogo da loja; não inventar módulo especializado |

O módulo automático inicial confere presença de cinco atributos em vedações. Demais critérios de segmento exigem revisão adicional; não são anunciados como implementados automaticamente.

## n8n

`gerar-n8n.mjs` gera o workflow a partir do mesmo `core.mjs`, evitando divergência nas regras. O arquivo gerado deve passar pelo validador do plugin antes de salvar como rascunho.

Fluxo: manual → GET lista de tenants com credencial existente → minimizar dados → quatro GET públicos por loja → classificar → relatório JSON/Markdown por loja. Não contém envio a clientes, cobrança, edição de produtos ou agendamento. Autenticação da lista é separada das consultas públicas; o token administrativo não vai aos domínios das lojas. Relatórios descartam contatos e campos de assinatura.

Esta versão n8n é **triagem HTTP pública**, sem amostra de produtos; o CLI adiciona até três produtos. A revisão visual, painel e venda permanecem explícitos como não testados. O relatório fica na saída da execução; persistência externa e agendamento não foram configurados.

A lista de tenants é um endpoint administrativo existente, verificado no código e usado pela operação da plataforma. Validade da credencial precisa de execução real; listagem de credenciais não comprova autorização no backend. Se a lista falhar, parar com erro, sem fabricar uma lista vazia como sucesso.

O gerador referencia a credencial existente pelo ID confirmado no plugin, sem incluir seu valor. Em outra instância n8n, descobrir e substituir essa referência antes de validar/importar. Não criar uma nova credencial vazia com o mesmo nome.

Antes de publicar: revisar a execução, confirmar tenant/domínios e objetivo de cada loja, validar credencial sem divulgar valor e definir armazenamento. Publicação somente após autorização. Nenhum fluxo existente de operação, cobrança ou alerta é alterado.

## Scripts existentes

| Script | Uso no protocolo | Efeito |
| --- | --- | --- |
| `scripts/smoke-publicacao.mjs` | Smoke pós-deploy de HTTP, CSS e imagem | Leitura HTTP; manter na rotina de deploy existente |
| `scripts/conferir-publicacao.ts` | Contrato detalhado de publicação e crawlers | Leitura HTTP; complementar a triagem |
| `scripts/conferir-marca-catalogo.ts` | Conferência especializada de marca | Revisar parâmetros e acesso antes de rodar |
| `scripts/qa-catalogo.ts` | Preparar ambiente QA de catálogo | Escreve dados; apenas banco isolado, nunca auditoria de produção |
| `scripts/completar-catalogo-sem-foto.mjs` | Operação de alteração de catálogo | Fora da coleta; exige proposta/revisão e autorização própria |

O padrão não transforma todo script existente em leitura segura. Rotinas de alteração ficam fora do coletor; seu reaproveitamento exige examinar o comportamento e separar diagnóstico de correção.

## Modelo de entrega humana

```text
Loja / domínio / tenant / segmento / objetivo / data / versão
Diagnóstico: pronta para qual operação? O que não foi comprovado?
Acessos: sistema | leitura realizada | escrita demonstrada | limitações
Problemas: ID | URL/tela | evidência | impacto | prioridade
Testes: entrada/ação | esperado | observado | estado | evidência
Catálogo/fotos: SKU/família | necessidade | ângulo/detalhe | prioridade
Propostas: antes/depois | fundamento | risco | verificação
Plano: sequência | responsável | dependências | critério de aceite
Limites: hipóteses | bloqueios | não testados | amostragem
Status: COMPLETED / PARTIALLY COMPLETED / FAILED
```
