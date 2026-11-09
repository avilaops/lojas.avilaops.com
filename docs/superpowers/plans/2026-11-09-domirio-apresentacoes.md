# Apresentações visíveis na vitrine Domi-Rio

Relato: cartão Cypertryne parece oferecer somente 100 mL; Glifosato 21 mL
não é percebido na home. Conferência pública: três volumes existem na ficha
Cypertryne e ambos os Glifosatos estão ativos, mas o cartão não mostra volumes.

- [x] Reservar espaço na seleção para Cypertryne e as duas apresentações Glifosato, respeitando estoque/foto/ativo.
- [x] Mostrar links diretos por apresentação nos cartões com grade na home Domi-Rio, com dados da variante desse tenant.
- [x] Testar seleção prioritária na CI e conferir navegação 35 mL/100 mL/1 L e Glifosato 21 mL/kit em produção.

Não criar produtos duplicados, alterar preços/estoque ou mudar outras lojas.
Execução pelo Codex; testes/build apenas CI, inspeção visual permitida.

Implementação 7dcca40, CI 42679615114 aprovada com deploy/fumaça após repetição
da entrega por limite de tempo. Inspeção pública em 390/1440 px: links dos três
volumes abrem títulos e códigos corretos (35 mL ISO140, 100 mL ISO014, 1 L ISO015);
Glifosato 21 mL e Kit10 presentes na grade da home. Sem overflow ou erros de
página. Evidências operacionais em .work/domirio-apresentacoes/revisao.json.
