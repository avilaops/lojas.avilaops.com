# Identidade pública e canais da VedaShow

## Intenção

Garantir que os dados comerciais confirmados de uma loja sejam publicados de
forma consistente na página de contato, no rodapé, no `llms.txt` e nos dados
estruturados. A VedaShow é o caso de validação inicial, sem criar uma exceção
por tenant.

## Estado confirmado em 18/10/2026

- WhatsApp: `551634413180`.
- Telefone: `(16) 3441-3180`.
- E-mail: `vendas@vedashow.com.br`.
- CNPJ: `58.392.666/0001-12`.
- Endereço público: não publicado.
- Horário: não publicado.

## Decisão

Uma projeção pura transforma os campos do `Tenant` em identidade pública.
Somente valores não vazios e válidos atravessam essa fronteira. Os consumidores
públicos usam a mesma projeção; os dados estruturados recebem `legalName`,
`taxID`, e-mail, telefone, contato de WhatsApp, endereço completo e horário
apenas quando cada campo estiver confirmado.

Endereço completo integra a identificação legal obrigatória e os dados
estruturados. `enderecoPublico` controla separadamente o convite de visita na
página de contato e no bloco principal do rodapé. Endereço incompleto não é
publicado em nenhuma dessas superfícies. Não haverá escrita no banco nem
valores fixos da VedaShow no código.

## Não objetivos

- Testar envio real de mensagem, ligação ou e-mail sem autorização externa.
- Preencher endereço, horário, emissão fiscal ou outros dados ainda não
  confirmados.
- Alterar políticas, checkout ou credenciais.

## Aceite

- A mesma projeção alimenta contato, rodapé, `llms.txt` e JSON-LD.
- Valores vazios ou malformados não são publicados.
- Endereço incompleto não aparece; endereço de visita exige autorização.
- A projeção do conjunto confirmado da VedaShow é coberta por teste literal.
- Nenhum dado de produção é alterado.
