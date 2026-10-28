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
- [x] Confirmar regressões na CI antes da correção: execução `40642109382`,
  três falhas esperadas e 196 integrações preservadas.
- [x] Fazer reserva, pedido e evento na mesma transação.
- [x] Corrigir projeção do comprador e validar limites monetários.
- [ ] Concluir interface operacional e casos negativos de acesso.
- [ ] Vincular observações reais ao plano MLOps e executar CI.

## Limites operacionais

Builds, testes e migrations somente no GitHub CI. Checkouts servem para leitura,
edição e Git. Publicação e efeitos reais externos exigem autorização própria.
Manter PR em rascunho para não acionar merge/deploy automático.
