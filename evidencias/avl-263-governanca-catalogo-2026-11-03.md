# AVL-263 — revalidação da governança do catálogo

## Escopo

A implementação original está versionada desde `785a5dc` (PR #152).
Esta retomada corrige validações que aceitavam preenchimento inválido e
acrescenta provas de integração da rota administrativa existente.

- Unidade exige texto; booleanos, números, arrays e objetos não suprem o campo.
- NCM exige oito dígitos ou formato `0000.00.00`, sem remover letras para
  transformar conteúdo inválido em válido. A verificação é de formato.
- Medidas em milímetros rejeitam tipos JSON indevidos e respeitam o teto
  técnico existente de 3000 mm. Números decimais legados em texto continuam
  aceitos.
- Dimensões da embalagem em centímetros não suprem medidas técnicas.
- “Anel O” e “Anéis O” são reconhecidos como família O-ring.
- A rota mantém o contrato de relatório completo por SKU, cobertura por
  campo/família e alertas de duplicidade/preço.

## Verificações

Seis testes de regressão falharam antes da correção e passaram depois dela.
O conjunto direcionado original e as primeiras regressões totalizaram
17 aprovações. Outros dois testes conferem os 11 campos obrigatórios e o
cálculo de cobertura por família; a validação final pertence à CI.

Três testes de integração passaram em PostgreSQL 18.6 local descartável:

1. Requisições sem token ou com token inválido recebem 401 antes de revelar
   existência da loja; loja inexistente com autenticação recebe 404.
2. A loja com 101 SKUs retorna todos os produtos e 1111 campos preenchidos;
   um SKU equivalente com outro preço em outra loja não entra no relatório
   nem produz conflito entre tenants.
3. SKUs equivalentes entre produtos da mesma loja geram duplicidade e conflito
   de preço; produtos, variantes, preços, saldos, mídias e contagens de
   histórico/eventos/movimentos permanecem iguais após o GET.

O banco descartável foi encerrado e removido após a prova. Nenhum dado real de
catálogo foi consultado ou alterado nesta validação.

A suíte geral local não produziu uma aprovação verificável: o ambiente
atingiu falta de espaço e pressão de memória durante as verificações.
TypeScript local também não possui aprovação utilizável. Conforme o
`AGENTS.md` da base atual, suíte geral, integração, TypeScript, lint e build
devem ser aprovados pelo workflow `Build e deploy` antes da publicação.
Os resultados definitivos e seus links serão registrados na AVL-263.

## Publicação

O usuário autorizou deploy nesta sessão. A entrega segue por PR, gates de CI,
merge e imagem do pipeline. A API é somente leitura; `BLOQUEADO` é um estado
do relatório e não despublica itens nem altera o checkout automaticamente.

Não há mudança de interface visual nem migração de schema nesta entrega.
