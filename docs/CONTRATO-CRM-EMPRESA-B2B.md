# Contrato CRM para empresas B2B

Contrato: `avila.lojas.empresa-b2b.v1`.

O Lojas publica eventos; o CRM mantém uma projeção e não altera o cadastro diretamente. Mudanças originadas no CRM devem chamar uma API autenticada do Lojas e produzir um novo evento.

## Transporte e idempotência

- O outbox do Lojas entrega eventos assinados ao n8n.
- `eventId` é estável em reentregas e é a chave de idempotência no consumidor.
- `versao` cresce por empresa. Evento com versão menor ou igual à já aplicada é ignorado.
- Falha de entrega conserva o payload e a correlação para retry.

## Envelope

```json
{
  "contrato": "avila.lojas.empresa-b2b.v1",
  "eventId": "uuid",
  "tipo": "empresa.atualizada",
  "ocorridoEm": "2026-10-18T17:00:00.000Z",
  "tenantId": "tenant-id",
  "empresaId": "empresa-id",
  "versao": 2,
  "correlacaoId": "uuid",
  "dados": {}
}
```

## Eventos

- `empresa.criada`, `empresa.atualizada`, `empresa.suspensa`: fotografia da empresa.
- `unidade.atualizada`: `unidadeId`, CNPJ, razão/nome, inscrição estadual, situação e endereços comerciais/fiscais.
- `contato.atualizado`: `contatoId`, unidade opcional, tipo, nome, cargo, e-mail e telefone comercial.
- `comprador.atualizado`: `compradorEmpresaId`, nome, e-mail comercial e situação.

Exclusão física não é publicada. Suspensão ou revogação usa situação explícita, preservando histórico e referências.

## Fontes de verdade

- Lojas: empresa, CNPJ/unidade, endereço, contato, comprador, centro de custo e situação comercial.
- Auth: conta, vínculo, papel, escopo e alçada.
- CRM: projeção para relacionamento; não é fonte de autorização nem de cadastro fiscal.

## Dados permitidos

Nome empresarial, nome fantasia, CNPJ, inscrição estadual, endereços comerciais/fiscais, nomes, cargos, e-mails e telefones comerciais, situações e IDs estáveis.

Nunca enviar senha, segredo, token, certificado, orçamento, consumo, alçada, documento pessoal ou endereço residencial.
