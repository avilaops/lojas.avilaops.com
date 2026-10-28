# Payloads da consulta de cupom v1

## Contrato e regras preservadas

`POST /api/v1/vitrine/cupom` usa `ConsultaDeCupom` e `RespostaDeCupom` de
`src/lib/api-cupom-contrato.ts`. O primeiro valida a requisição; o segundo
valida a saída antes de serializar. A configuração de autorização também é
compartilhada pela rota e pela exportação. `ErroDeCupom` é conferido contra
as respostas reais do wrapper nos testes de integração com PostgreSQL.

O código vem aparado antes dos limites de 1–40 caracteres. Há 1–50 itens,
IDs aparados de 1–80 caracteres e quantidades inteiras de 1–999. CEP é opcional,
com 8–9 caracteres após aparar; este schema não certifica um CEP válido.
Campos desconhecidos continuam recusados, inclusive dentro dos itens.

O sucesso traz `dados.codigo`, `dados.tipo`, `dados.descontoCentavos` inteiro
não negativo e, opcionalmente, opções de frete. `tipo` permanece string:
o banco atual não impõe enum nesse campo. Erros preservam código estável,
mensagem, detalhe opcional e ID de requisição. A tabela de códigos/status
exportada é a tabela compartilhada da API, um conjunto conservador: não
afirma que todos esses erros sejam alcançáveis pela consulta de cupom.

A chave exige `vitrine:comprar`. Origem, limites por chave/endereço e recusa
uniforme de cupons permanecem no domínio/wrapper existentes. A consulta não
aplica desconto ao pedido; a compra calcula tudo novamente.

## Exportação e compatibilidade

O exportador lê os schemas Zod da revisão testada. Usa um subconjunto fechado:
objetos, campos opcionais, strings, inteiros/números, enums e arrays com limites
inclusivos. Construções não suportadas interrompem a exportação.

`x-trim: true` declara normalização **antes** da validação de comprimento.
Essa extensão precisa de um leitor ciente da normalização; um validador JSON
Schema genérico que ignore a extensão não representa a aceitação do corpo
bruto. O consumidor de referência envia o corpo bruto; a API o normaliza.
O gate compara também a extensão e recusa mudança de normalização.

Para entrada, todos os valores antes aceitos precisam continuar aceitos.
Para saída/erro, os valores novos precisam ser aceitos pelo contrato anterior.
O comparador considera campos obrigatórios, propriedades adicionais, limites,
tipos e enumerações. Alterar escopo, configuração de origem/limite ou códigos
HTTP também reprova para revisão. Isso não avalia a semântica de autorização.

O baseline fica em `contracts/cupom.v1.json`. Na introdução, o relatório declara
`initial_contract`, sem compatibilidade histórica presumida. Em PRs seguintes,
o baseline é lido do commit base, mesmo que o candidato ou worktree tentem
alterar a cópia. Atualizar o JSON candidato não apaga o contrato anterior.
Em push/manual, compara-se ao próprio commit: não é comparação com a release
anterior. Mudança incompatível exige contrato/rota versionados e migração.

## Consumidor e evidência

`examples/contracts/cupom-v1.ts` fixa tipos e um leitor próprios, sem importar
schemas da aplicação. Envia JSON por HTTPS (HTTP somente no loopback de teste),
recusa redirecionamentos, aceita extensões de resposta e preserva status,
código, detalhe e correlação em `ErroConsultaCupom`. Há timeout de 10 segundos
por padrão; o chamador pode passar seu próprio AbortSignal. Falhas de rede e
interrupção propagam sem reenviar a consulta ou registrar credenciais.

Testes de HTTP usam servidor real isolado e corpos sintéticos. A integração
PostgreSQL existente confere respostas reais da rota contra o produtor e o
consumidor, incluindo recusa uniforme, isolamento, origem, limites e frete.
Ela invoca o handler com Request/Response reais; não é um teste de proxy/deploy.

No job de integração existente da CI, testes do contrato antecedem exportação
e comparação. O artefato `lojas-payloads-<sha>` guarda contrato, baseline e
`cupom-compatibility.json`, com SHAs e hashes das fontes; retenção de 14 dias.
Imagem depende desse job. Tipos, lint, testes unitários e build continuam no
job de imagem, e PostgreSQL continua no job de integração. Não há execução
de código ou build no servidor, nem importação automática no laboratório.

Esta entrega cobre o payload desta operação. Não certifica outras rotas,
semântica comercial, produção ou o piloto cotação/pedido. Referências de
políticas e testes afetados: `api-cupom.ts` (recusa e limite), `api-rotas.ts`
(identidade/origem/tenant), `api-resposta.ts` (erros), `docs/API.md` e
`tests/integration/api-v1-checkout.test.ts`.
