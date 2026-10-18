# Identidade empresarial B2B

## Intenção

Representar clientes empresariais sem confundir empresa, CNPJ, unidade e pessoa compradora. O Auth continua sendo a fonte de identidade, papéis e alçadas; o Lojas guarda o contexto comercial pertencente a cada loja.

## Limites de responsabilidade

- **Auth:** conta da pessoa, organização, unidades autorizadas, papéis e limite de aprovação. Suspensão e revogação têm efeito na próxima consulta de contexto.
- **Lojas:** empresa cliente, unidades fiscais, endereços, contatos, compradores vinculados, centros de custo, orçamento operacional e trilha de auditoria.
- Identificadores do Auth são armazenados somente como referências estáveis. O Lojas nunca autoriza uma operação com uma cópia antiga de papel ou alçada.
- O provisionamento entre os produtos é `avila.corporativo.v2`; a consulta de contexto permanece `avila.corporativo.v1`. Ambos ficam documentados em `docs/CONTRATO-AUTH-CORPORATIVO.md`; a saída para CRM usa `avila.lojas.empresa-b2b.v1`, documentado em `docs/CONTRATO-CRM-EMPRESA-B2B.md`.

## Modelo

- `EmpresaB2B`: cliente empresarial dentro de um tenant vendedor, identificado por uma referência local e, depois do provisionamento, pelo ID da organização no Auth. A referência enviada ao Auth é determinística e global no cliente: `lojas:<tenantId>:empresa:<empresaId>`.
- `UnidadeEmpresaB2B`: matriz ou filial com CNPJ próprio, inscrição estadual, nome, referência normalizada única na empresa e eventual ID de unidade no Auth. A referência enviada ao Auth é `lojas:<tenantId>:unidade:<unidadeId>`.
- `EnderecoUnidadeEmpresaB2B`: endereços tipados da unidade, separados do cadastro da empresa.
- `ContatoEmpresaB2B`: contato comercial ou fiscal da empresa, opcionalmente ligado a uma unidade.
- `CompradorEmpresaB2B`: vínculo entre uma pessoa e uma empresa. Pode apontar por FK composta para a conta B2C existente, evitando cadastro pessoal duplicado, e guarda o `vinculoId` devolvido pelo provisionamento. O Auth não fornece `contaId` ao Lojas.
- `AutorizacaoDesejadaB2B`: conjunto completo e versionado que será enviado ao Auth, com papel, escopo `ORGANIZACAO | UNIDADE`, unidade opcional e alçada. É intenção/outbox, não fonte de autorização.
- `ProvisionamentoCompradorB2B`: dono do estado `PENDENTE | SINCRONIZADO | FALHOU | SUSPENSO | REVOGADO`, versão, tentativas, correlação, erro sanitizado e timestamps. Atualizações do mesmo comprador são serializadas e o POST sempre substitui o conjunto completo da versão corrente.
- `EscopoCompradorB2B`: projeção reconciliada do último contexto consultado, também com escopo `ORGANIZACAO | UNIDADE`; serve para diagnóstico e interface, nunca para autorizar.
- `CentroCustoB2B`: código, nome, orçamento em centavos, período mensal e saldo consumido pertencentes à empresa. Neste módulo, “limites” significa esse orçamento operacional e a alçada monetária do Auth; limite de crédito é trabalho futuro.
- `CompradorCentroCustoB2B`: associação de compradores a centros de custo.
- `AuditoriaB2B`: ação, ator, entidade e estados anterior/posterior em JSON, sempre sob o mesmo tenant.

Toda relação inclui `tenantId` e usa chave estrangeira composta quando cruza agregados. `Comprador` recebe a chave compatível `@@unique([tenantId, id])` e a relação inversa, sem mudar seu login B2C. Isso impede que uma linha de uma loja seja ligada acidentalmente a dados de outra.

## Fluxos

### Cadastrar ou atualizar empresa

1. Normalizar CNPJ, e-mail e referências.
2. Criar ou atualizar empresa, unidades, endereços, contatos e centros de custo em transação.
3. Vincular uma conta B2C já existente pelo par `tenantId + email`; não criar outra pessoa.
4. Gravar a versão completa da intenção e o estado `PENDENTE` na mesma transação.
5. Provisionar organização, unidades e autorizações no Auth com credencial de sistema. O POST v2 leva versões monotônicas separadas da organização e do comprador e retorna `organizacaoId`, `vinculoId`, `versao` e as versões efetivamente aplicadas; os IDs das unidades só são aprendidos posteriormente pelo contexto OIDC.
6. Persistir os IDs retornados e registrar a auditoria. Timeout ou falha vira `FALHOU`, preserva o payload completo e pode ser repetido com a mesma correlação. Uma nova edição cria outra versão e nunca reenvia uma versão obsoleta.

### Autorizar uma operação

Este módulo entrega o cliente e o contrato, mas não ativa autorização corporativa no login atual: `src/lib/sso.ts` possui apenas sessão compartilhada e não recebe access token. A tarefa de sessão corporativa deve implementar Authorization Code + PKCE, callback com `state`/`nonce`, tokens cifrados somente no servidor, vínculo do `sub` ao comprador, renovação com refresh token e reautenticação ao expirar.

Depois dessa dependência:

1. Solicitar OIDC com `corporate_context` por Authorization Code + PKCE.
2. Consultar `GET /api/corporativo/contextos` no servidor com access token válido.
3. Exigir organização e unidade escolhidas quando houver mais de uma.
4. Conferir que o contexto pertence à empresa e à unidade locais do tenant corrente.
5. Aplicar papel e alçada retornados pelo Auth; orçamento e centro de custo vêm do Lojas.

## Compatibilidade e migração

- `Comprador` e `EnderecoComprador` mantêm comportamento e dados atuais; apenas recebem chave composta e relação inversa compatíveis.
- A migração cria somente estruturas novas; não inventa empresa a partir de CPF, pedido ou domínio de e-mail.
- A promoção explícita de um comprador existente reutiliza seu `Comprador.id` e é idempotente por empresa e e-mail.
- Empresa é única por `tenantId + referencia`; unidade é única por `tenantId + empresaId + referencia` e por `tenantId + cnpj`; IDs do Auth também são únicos dentro do tenant.
- Campos do Auth começam nulos, permitindo cadastrar a estrutura antes de o provisionamento estar disponível.

## Segurança e falhas

- Toda consulta de domínio exige `tenantId`; APIs não aceitam tenant fornecido pelo cliente quando ele pode ser derivado da sessão.
- E-mails ficam normalizados em minúsculas e CNPJs contêm 14 dígitos.
- CNPJ é obrigatório por unidade. CHECKs no PostgreSQL exigem 14 dígitos e valores monetários inteiros não negativos.
- Provisionamento é idempotente; timeout não apaga dados locais nem marca acesso como concedido.
- Resposta de contexto com contrato desconhecido, organização divergente ou unidade não cadastrada fecha o acesso.
- Auditoria é append-only e registra toda mutação e cada tentativa/resultado de provisionar, suspender ou revogar: ator (tipo, ID e e-mail), correlação, tenant, empresa, entidade, resultado e JSON sanitizado, na mesma transação da mutação local. Nunca armazena segredo, token, senha ou certificado.
- Promoção é única por `tenantId + empresaId + emailNormalizado`. Mudança de e-mail cria evento de reconciliação; depois do provisionamento, o `vinculoId` é a identidade estável.

## Contrato CRM v1

- Transporte: evento assinado no outbox/n8n, contrato `avila.lojas.empresa-b2b.v1`.
- Eventos: `empresa.criada`, `empresa.atualizada`, `empresa.suspensa`, `unidade.atualizada`, `contato.atualizado` e `comprador.atualizado`.
- Identidade: `eventId` é a chave de idempotência; payload leva `tenantId`, `empresaId`, `unidadeId`, `contatoId` ou `compradorId` estáveis e `versao` monotônica do agregado.
- Fonte de verdade: Lojas para cadastro comercial; Auth para identidade e autorização; CRM só projeta e nunca grava de volta sem passar pela API do Lojas.
- Atualização envia fotografia da entidade; suspensão usa evento explícito, sem exclusão física. Reentrega repete o mesmo `eventId`.
- PII mínima: nome empresarial, CNPJ, nomes/e-mails/telefones comerciais e IDs. Não envia senha, token, alçada, orçamento, documento pessoal, endereço residencial ou certificado.

## Aceite

- Empresa, CNPJs/unidades, endereços, contatos e compradores são entidades separadas.
- Uma empresa admite vários compradores e unidades; cada comprador pode receber várias unidades e centros de custo.
- Papéis e alçadas são provisionados e verificados no Auth; centros de custo e orçamentos são persistidos no Lojas.
- Restrições compostas e testes provam isolamento entre tenants.
- Compradores atuais continuam funcionando e podem ser vinculados sem duplicação.
- Contrato Auth/CRM e responsabilidades ficam documentados para as tarefas dependentes.

## Não objetivos

- Tela completa de administração B2B.
- Fluxo de aprovação de pedido, catálogo negociado ou preço por empresa.
- Sincronização com CRM; este módulo publica o contrato que o AVL-247 consumirá.
