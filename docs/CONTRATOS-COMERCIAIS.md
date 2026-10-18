# Contratos comerciais

## Conferência da migração

Antes do deploy, registre a quantidade de lojas e as regras excepcionais:

```sql
SELECT count(*) AS lojas FROM "Tenant";
SELECT slug, plano, "faixaPreco" FROM "Tenant"
WHERE slug IN ('vedashow', 'bereta-rodas');
```

Depois da migração, as contagens devem coincidir e não pode haver loja sem
contrato ou mais de um contrato ativo:

```sql
SELECT count(*) AS contratos_iniciais FROM "ContratoComercial" WHERE versao = 1;
SELECT t.slug, count(c.id) AS contratos
FROM "Tenant" t LEFT JOIN "ContratoComercial" c ON c."tenantId" = t.id
GROUP BY t.id HAVING count(c.id) <> 1;
SELECT t.slug, c."mensalidadeCentavos", c."comissaoPontosBase"
FROM "Tenant" t JOIN "ContratoComercial" c ON c."tenantId" = t.id
WHERE t.slug IN ('vedashow', 'bereta-rodas');
```

O resultado esperado das exceções é Vedashow `35000/500` e Bereta Rodas
`mensalidade anterior/300`.

## Recuperação

A migração é aditiva e o código anterior ignora a tabela e a coluna novas. Se
o deploy falhar, o pipeline mantém a imagem anterior. Para desfazer também os
dados, restaure o dump obrigatório feito imediatamente antes da migração,
conforme `docs/BACKUP-E-ROLLBACK.md`. Não remova a tabela depois que houver
pedidos vinculados: isso descartaria o histórico que define a comissão.
