# Contrato executável da consulta de cupom v1

Módulo da fundação MLOps / AVL-343. Contrato de entrada, saída e erro de
`POST /api/v1/vitrine/cupom`, derivado de schemas usados pela rota real.
Preservar validação, normalização, escopo, origem, limites e recusa uniforme.

A chamada consulta um desconto; não reserva estoque nem confirma pedido.
Validar a resposta na fronteira HTTP. Extrair o schema de entrada atual sem
alterar seus limites. Tipos e testes com PostgreSQL ligam produtor e contrato.

Usar Zod 3 existente e um exportador restrito aos tipos efetivamente usados,
que recusa construções não suportadas. Não acrescentar dependências ou usar
uma cópia manual de OpenAPI como se fosse exportação do código. Exportar
JSON Schema com a normalização trim explícita. O consumidor de exemplo fixa
seu próprio contrato para detectar divergência do produtor.

Compatibilidade direcional: a nova entrada aceita tudo que a anterior aceitava;
a nova saída pertence ao conjunto aceito pelo consumidor anterior. Comparar
tipos, propriedades, obrigatoriedade, enumerações e limites de strings,
números e arrays. Recusar estruturas não suportadas, sem aprovação silenciosa.

Baseline inicial versionado em contracts/cupom.v1.json. Nas próximas revisões
de PR, obter esse arquivo da base do PR, impedindo que editar a cópia candidata
apague o histórico. A introdução inicial é explícita no relatório. Incluir
SHAs, hashes das fontes, contrato exportado e diferenças no artefato da CI.

Alternativas consideradas: snapshot textual não verifica direção; gerar toda
a API exigiria definir contratos ausentes. Este módulo fecha uma operação
real e registra a cobertura restante sem certificar a API inteira.

Validação exclusivamente no GitHub CI existente: testes negativos de
compatibilidade e exportação, consumidor HTTP com servidor isolado, tipos,
lint, suíte completa e integração com PostgreSQL. Nenhum deploy autorizado.
