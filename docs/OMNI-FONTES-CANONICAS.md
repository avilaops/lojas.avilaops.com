# Lojas 360 — Fontes canônicas e propriedade dos dados

<!-- markdownlint-disable MD013 MD060 -->

Este documento é o contrato do marco **OMNI-0.1**. Ele define quem possui cada
dado, quem pode escrevê-lo e o que fazer quando o Lojas e um sistema externo
divergem. Os contratos especializados continuam valendo; esta matriz decide a
autoridade entre eles.

## Vocabulário e políticas globais

- **Fonte canônica** é o sistema cujo fato prevalece. Não significa que esse
  sistema seja o único que armazena uma cópia.
- **Réplica** é uma projeção para consulta ou operação. Deve guardar a origem,
  o identificador externo, o instante observado e, quando aplicável, a versão.
- **Decisão local** é uma intenção do lojista ou operador. Ela não vira fato
  externo até o provedor confirmar a aplicação.
- **Estado observado** é a última resposta confirmada pelo sistema canônico.
  Falha de consulta não apaga esse estado; marca-o como desatualizado.
- **Dado derivado** nunca vence seus fatos de origem. É recalculado ou
  invalidado quando qualquer dependência muda.
- Eventos externos são aplicados por chave idempotente do provedor. Repetição,
  atraso ou reordenação não podem duplicar efeito nem regredir um estado final.
- Escrita financeira, fiscal, destrutiva ou de identidade com ambiguidade exige
  revisão humana. A prévia mostra antes/depois, origem e impacto.
- Credenciais e segredos não fazem parte desta matriz de negócio: pertencem ao
  cofre/configuração da integração, são cifrados e nunca aparecem em logs ou
  réplicas de leitura.

As colunas abaixo têm significado fixo:

| Coluna | Significado |
|---|---|
| Grupo de campos | Unidade que compartilha a mesma autoridade |
| Fonte canônica | Sistema cujo fato prevalece |
| Escritores autorizados | Atores que podem propor ou confirmar mudança |
| Réplicas e consumidores | Onde o dado pode ser copiado ou projetado |
| Conflito ou exceção | Detecção e resposta operacional obrigatórias |

## Catálogo

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Identidade interna (`Produto.id`) e vínculo entre produto, variante, kit e unidade | Lojas | Somente o Lojas cria e mantém a identidade interna | ERP, canais e feeds recebem o ID estável como referência, nunca como chave própria | ID externo nunca substitui `Produto.id`; vínculo ambíguo mantém os registros separados e abre revisão |
| SKU, referência, MPN e GTIN | Lojas, salvo cada campo declarado como mestre no ERP | Lojista; ERP apenas nos identificadores concedidos pela conexão | Variantes, ERP, canais e feeds recebem os identificadores normalizados | Renomeação respeita versão/instante da fonte autorizada; duplicidade ou desacordo entre SKU e GTIN bloqueia vínculo automático |
| Título, descrição, marca, dimensões, peso e atributos mestres | Lojas, salvo campo declarado como mestre no ERP | Lojista; ERP somente nos campos concedidos pela matriz da conexão | Anúncios, Merchant Center, checkout e atendimento | Mudança concorrente usa versão/instante; campo sem propriedade declarada não é sobrescrito por importação |
| Categoria interna e classificação fiscal do produto | Lojas para categoria comercial; ERP/fiscal para classificação fiscal quando integrado | Lojista na categoria; fiscal/ERP nos campos fiscais concedidos | Canais recebem mapeamentos, não a categoria interna como verdade externa | Divergência fiscal bloqueia emissão/publicação dependente e exige revisão; não converter silenciosamente taxonomias |
| Categoria, atributos exigidos e políticas de anúncio do canal | O próprio canal | Canal confirma; lojista escolhe entre valores permitidos | Lojas guarda mapeamento versionado e estado observado | Mudança de taxonomia invalida a prontidão dos afetados, preserva exceções manuais e não altera o produto mestre |
| Mídia original | Lojas ou repositório de mídia contratado pelo Lojas | Lojista e importadores autorizados | Derivações por canal preservam referência ao original | Recusa de formato/tamanho gera derivação ou pendência; nunca substitui o original por uma cópia degradada |
| Identificador e conteúdo publicado do anúncio | Canal para ID/estado observado; Lojas para intenção de publicação própria | Lojista aprova intenção; adaptador envia; canal confirma | `AnuncioMercadoLivre` e futuros adaptadores guardam ID, origem e resposta | Anúncio adotado preserva conteúdo externo salvo autorização explícita; falha parcial mostra campos aceitos e recusados |

Referências: `docs/CATALOGO-PADRONIZADO.md`, `docs/CANAIS-MARKETPLACES.md`
e `docs/MERCADO-LIVRE.md`.

## Preço

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Custo e preço-base do produto | Lojas, salvo ERP declarado mestre desses campos | Lojista; ERP apenas nos campos concedidos | Checkout, simulador, canais e relatórios | Importação antiga não vence edição mais nova; custo ausente torna margem desconhecida, nunca zero presumido |
| Regras comerciais por canal, cliente, contrato, quantidade e promoção | Lojas | Lojista ou aprovador com escopo da loja | Motor de preço e prévias por canal | Regras incompatíveis são rejeitadas antes de publicar; prioridade e vigência devem ser explícitas |
| Taxas, comissão e subsídio do canal | Canal ou contrato vigente do provedor | Canal confirma; operador apenas registra hipótese para simulação | Simulador e conciliação guardam período/fonte | Taxa estimada não fecha financeiro; diferença entre estimativa e evento cobrado vira divergência |
| Preço pretendido no canal | Lojas, como projeção do preço-base e regras aprovadas | Motor de preço após aprovação humana | Adaptador envia ao canal | Proteção de preço mínimo e margem bloqueia redução; arredondamento nunca reduz abaixo do pretendido |
| Preço efetivamente exibido/cobrado | Canal para venda externa; Lojas para loja própria | Canal ou checkout confirma | Conciliação e pedido registram o valor observado no momento da venda | Divergência pretendido × observado é acionável; pedido preserva o preço vendido e não é reprecificado depois |

Referências: `docs/CANAIS-MARKETPLACES.md`, `docs/CONTRATOS-COMERCIAIS.md`
e `docs/POLITICA-COMISSAO.md`.

## Estoque

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Saldo físico atual (`SaldoEstoque.fisico`) | Lojas, até uma conexão declarar o WMS/ERP como mestre | Escritas transacionais do catálogo e do estoque | Checkout, canais, painel e relatórios | No código atual, o saldo inicial pode existir sem movimento; por isso ele é a autoridade até a migração para uma razão completa |
| Razão de movimentos por produto, variante e local | Estado-alvo do Lojas; hoje é trilha parcial, não fonte suficiente para reconstrução | Operações de entrada, reserva, venda, cancelamento, devolução e ajuste autorizado | `MovimentoEstoque`; ERP/WMS recebem eventos idempotentes | OMNI-0.4 deve criar movimento de abertura/migração antes de promover a razão a canônica; movimento repetido não duplica efeito |
| Saldo disponível | Derivado do saldo físico atual, reservas e compromissos | Somente o motor de estoque transacional | Checkout, canais, painel e relatórios | Divergência é recalculada a partir do saldo físico vigente; depois da migração completa, correção passa a exigir movimento compensatório |
| Reserva | Lojas para checkout e pedidos que controla; canal para reserva que só ele expõe | Motor de pedidos e canal conforme contrato | Estoque disponível e promessa de atendimento | Reserva expirada é liberada uma vez; cancelamento e confirmação concorrentes usam transação/idempotência |
| Quantidade pretendida por canal | Lojas, derivada do disponível, reserva de segurança e teto do canal | Motor de estoque após regras aprovadas | Adaptador de cada canal | Resultado negativo vira zero; kit/variante consome componentes corretos antes de projetar |
| Quantidade observada no canal | Canal | Canal confirma | Central de Conciliação mantém último valor e instante | Diferença para o pretendido gera reenvio seguro ou revisão; falha de leitura mantém valor antigo marcado como defasado |

Referências: `docs/CATALOGO-PADRONIZADO.md`, `docs/MERCADO-LIVRE.md` e modelos
`SaldoEstoque`, `ReservaEstoque` e `MovimentoEstoque` em `prisma/schema.prisma`.

## Pedido

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Identidade local e referência pública não enumerável | Lojas | Lojas na criação do pedido | Atendimento, fiscal, financeiro e logística | Referência nunca deriva de ID sequencial externo; colisão é rejeitada pela unicidade |
| Identidade externa (`canal`, `canalPedidoId`) | Canal de origem | Canal confirma; adaptador registra | Pedido local mantém vínculo único por tenant/canal | Reentrega do mesmo evento encontra o pedido existente; identidade ausente ou ambígua vai para exceção |
| Itens, quantidades, preço vendido, descontos e endereço no fechamento | Origem da venda: checkout Lojas ou canal | Origem confirma; Lojas registra snapshot imutável | Fiscal, separação, atendimento e relatórios | Mudança posterior de catálogo/preço não altera snapshot; correção exige evento explícito e auditoria |
| `pagamentoStatus`, `pagamentoId` e fatos de cobrança | Gateway/canal que processou a cobrança | Provedor confirma; webhook e verificação periódica registram | `Pedido` replica o último fato confirmado e o financeiro preserva os eventos | Operador não promove pagamento manualmente; divergência de valor ou status mantém o pedido pendente e abre conciliação |
| `Pedido.status` | Lojas, derivado de fatos confirmados e ações operacionais autorizadas | Motor de pedidos; operador somente nas transições operacionais permitidas | Canais, cliente, ERP e atendimento | Pagamento confirmado pode promover para pago; cancelamento/estorno confirmado prevalece; evento atrasado não regride pedido enviado ou encerrado |
| Estado fiscal do pedido | SEFAZ/provedor fiscal para autorização; Lojas para a pendência operacional | Provedor confirma documento; operador solicita emissão/correção | Pedido referencia documento, protocolo e eventos, sem copiá-los como texto editável | Pedido não vira fiscalmente concluído sem autorização; rejeição ou indisponibilidade permanece pendência separada do pagamento |
| `rastreio`, contratação e eventos de entrega | Transportadora/canal logístico para fatos; Lojas para rastreio manual identificado | Provedor confirma; operador autorizado informa origem manual | Pedido guarda rastreio e a logística mantém a linha do tempo | Rastreio manual não vence confirmação incompatível do provedor; evento fora de ordem não regride entrega concluída e abre divergência |
| Linha do tempo e autoria | Lojas | Todo comando/evento aceito acrescenta entrada | Painel, suporte e auditoria | Histórico é append-only; retificação referencia evento anterior em vez de apagá-lo |
| Cancelamento, devolução e reembolso | Provedor que confirma cada efeito; Lojas orquestra a intenção | Operador autorizado solicita; canal/pagamento confirma | Pedido agrega o estado confirmado de cada etapa | Falha parcial permanece pendente; não marcar cancelado/reembolsado antes das confirmações necessárias |

Referências: `docs/API.md`, `docs/MERCADO-LIVRE.md` e modelos `Pedido` e
`PedidoItem` em `prisma/schema.prisma`.

## Cliente

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Identidade interna do perfil | Lojas | Lojas ao receber cadastro ou pedido | Pedidos, atendimento, campanhas e ERP/CRM | Perfis não são fundidos só por nome; merge ambíguo exige humano e permanece reversível |
| Identificadores verificados (e-mail, telefone, documento e IDs externos) | Emissor/verificador de cada identificador; Lojas mantém o vínculo | Cliente, operador autorizado e adaptador de origem | Cliente 360 preserva origem, verificação e restrições | Valores conflitantes coexistem até resolução; canal que mascara dado não é usado para completar identidade |
| Nome, endereços e preferências | Cliente no Lojas ou origem transacional declarada | Cliente e operador autorizado | Checkout, pedido e atendimento | Pedido guarda snapshot; atualização de perfil não reescreve pedidos anteriores |
| Consentimento, base legal, finalidade e supressão | Estado-alvo: Lojas para coleta própria; canal para contatos sob política do canal | Titular e operador autorizado segundo a finalidade | Hoje o consentimento de pixels existe somente no `localStorage`; persistência auditável para campanhas/jornadas ainda não está implementada | Até existir registro versionado no backend, o Lojas não pode afirmar consentimento centralizado nem usar a escolha local em campanha; consentimento de um canal não migra para outro |
| Restrições impostas pelo canal | Canal | Canal confirma | Atendimento e marketing exibem o limite | Dado permitido apenas para execução do pedido não alimenta campanha ou perfil além da finalidade |

Referências: `docs/CONFORMIDADE.md`, `docs/CONTRATO-CRM-EMPRESA-B2B.md` e
`docs/API.md`.

## Fiscal

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Cadastro fiscal da loja e do produto | ERP/fiscal quando integrado; Lojas enquanto for mantido localmente | Responsável autorizado; integração nos campos concedidos | Emissão, recebimento e canais | Divergência de CNPJ/classificação bloqueia efeito fiscal e exige revisão; nunca escolher pelo dado mais recente sem autoridade |
| XML, chave, protocolo, status e eventos de documento autorizado | SEFAZ ou provedor fiscal autorizado | Provedor confirma; Lojas somente armazena cópia íntegra | Lojas, ERP, pedido e auditoria | Documento autorizado é imutável; cancelamento/correção entra como novo evento, não edição |
| NSU e cursor de distribuição de DF-e | Lojas por CNPJ, refletindo o Ambiente Nacional | Rotina fiscal transacional | `FiscalLoja` e monitoramento | Falha ao persistir documento não avança cursor; consulta concorrente é bloqueada e consumo indevido respeita intervalo |
| Manifestação do destinatário | SEFAZ após comando explícito | Operador autorizado solicita; SEFAZ confirma | Lojas guarda intenção, protocolo e resultado | Ausência de suporte/autoridade não é inferida como manifestação; falha permanece pendente com prazo |
| DANFE e projeções de leitura | Derivados do XML canônico | Renderizador do Lojas/ERP | Painel, download e atendimento | Erro de renderização não altera XML; schema desconhecido mantém o original disponível e sinaliza limitação |

Referências: `docs/FISCAL-RECEBIMENTO.md` e modelos `FiscalLoja` e
`DocumentoFiscalLoja` em `prisma/schema.prisma`.

## Financeiro

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Intenção de cobrança, parcelamento e referência comercial | Lojas | Checkout, pedido e operador autorizado | Gateway recebe referência idempotente | Repetição reutiliza a mesma intenção; mudança material cria nova versão, não reaproveita cobrança confirmada |
| Autorização, captura, recusa, estorno e chargeback | Gateway ou canal financeiro | Provedor confirma; webhook e verificação periódica registram | Pedido e razão financeira guardam IDs e eventos | Webhook não é fonte única: consulta reconcilia; evento repetido ou tardio não duplica crédito nem regride estado final |
| Valor bruto, tarifas, retenções, frete, estornos e líquido | Canal/gateway para fatos cobrados | Provedor confirma | Conciliação, ERP e relatórios | Estimativa nunca substitui lançamento; diferença preserva ambos os valores e abre pendência |
| Repasse e depósito bancário | Gateway/canal e extrato correspondente | Provedor confirma; operador associa quando necessário | Fechamento financeiro | Associação ambígua não fecha automaticamente; muitos-para-um preserva todas as referências |
| Comissão da plataforma atual | Contrato comercial vigente e registros de pedido/cobrança existentes no Lojas | Rotinas comerciais atuais calculam a obrigação; operador autorizado registra a cobrança conforme a política aprovada | Relatórios e conferência usam contrato, pedido e cobrança sem presumir uma razão inexistente | A comissão não pode ser ativada fora dos gates contábil, fiscal, jurídico e de privacidade definidos em `docs/POLITICA-COMISSAO.md`; divergência exige revisão |
| Razão de comissão e crédito interno | Estado-alvo do Lojas, ainda não implementado | Futuro motor financeiro; ajuste somente por lançamento compensatório autorizado | Cobrança, relatório e ERP | Antes da migração e das aprovações obrigatórias, não declarar saldo conciliado; depois, nunca editar histórico e vincular estorno/correção ao original |

Referências: `docs/MERCADO-PAGO-OAUTH.md`, `docs/MATRIZ-COMISSAO.md` e
`docs/POLITICA-COMISSAO.md`.

## Atendimento

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Identidade da conversa, pergunta, reclamação ou mediação | Canal de origem | Canal confirma; adaptador registra | Caixa de entrada do Lojas mantém vínculo externo | Evento repetido atualiza a mesma conversa; item sem vínculo continua visível e vai para exceção |
| Conteúdo recebido e anexos | Canal de origem | Remetente pelo canal | Lojas guarda cópia conforme retenção e política | Conteúdo removido/restrito mantém metadados mínimos permitidos; anexo indisponível mostra causa |
| Resposta e ação pretendida | Lojas | Operador autorizado ou automação aprovada | Canal recebe o comando | Antes do envio é rascunho local; só vira enviado após confirmação do canal; recusa preserva texto e motivo |
| Estado observado da conversa e SLA externo | Canal para estado; Lojas para cálculo operacional do prazo | Canal confirma estado; Lojas calcula alerta | Central de Exceções e atendimento | Relógio usa prazo do canal quando disponível; falha de sincronização não encerra caso nem SLA |
| Atribuição interna, fila, prioridade, notas e SLA interno | Lojas | Regras e operadores autorizados | Painel e relatórios | Mudança externa não apaga organização interna; encerramento exige motivo e estado externo compatível quando aplicável |

Referência atual: perguntas do Mercado Livre em `docs/MERCADO-LIVRE.md`. Novos
canais devem preservar a mesma separação entre fato externo e trabalho interno.

## Logística

| Grupo de campos | Fonte canônica | Escritores autorizados | Réplicas e consumidores | Conflito ou exceção |
|---|---|---|---|---|
| Origem, embalagem, peso, dimensões e regras de retirada/frete próprio | Lojas | Lojista; ERP nos campos concedidos | Cotadores, checkout e canais | Medida padrão é fallback explícito; não sobrescreve medida real nem finge precisão em auditoria |
| Serviço, preço e prazo cotados | Provedor consultado no instante da cotação ou tabela local do Lojas | Provedor/tabela confirma | Pedido guarda snapshot da opção aceita | Cotação expirada é refeita; falha de um contrato não cai silenciosamente em outro contrato do qual a loja não é titular |
| Contratação, etiqueta, lista e coleta | Transportadora/agregador que confirma a operação | Operador solicita; provedor confirma | Lojas guarda IDs, documentos, custo e estado | Falha parcial não marca contratado; reenvio usa chave idempotente e ação destrutiva pede confirmação |
| Código de rastreio e eventos de transporte | Transportadora ou canal logístico | Provedor confirma; operador só informa rastreio manual com origem marcada | Pedido, cliente, atendimento e canal | Eventos fora de ordem compõem a linha do tempo sem regredir entrega final; rastreio divergente exige revisão |
| Promessa e estado operacional de separação/despacho | Lojas, combinando pedido e fatos logísticos | Operadores e motor de pedidos | Painel, cliente e canal | Atraso é calculado contra a promessa registrada; alteração de prazo não apaga violação anterior |
| Entrega, extravio, devolução ao remetente e comprovante | Transportadora/canal | Provedor confirma | Lojas replica e vincula ao pedido/RMA | Contestação mantém estado do provedor e estado da disputa separados até decisão |

Referências: `docs/MELHOR-ENVIO.md`, `docs/CEPCERTO-APIS.md` e
`docs/ROTINAS.md`.

## Resolução padrão de divergências

1. Identificar tenant, entidade, campo, fonte, versão/instante e chave externa.
2. Comparar **intenção local**, **estado observado remoto** e **fato canônico**;
   nenhum dos três pode ser sobrescrito antes da decisão.
3. Se a fonte canônica estiver disponível e a correção for segura e
   idempotente, gerar prévia e reprocessar pelo adaptador.
4. Se houver ambiguidade, efeito financeiro/fiscal, perda de informação ou
   ação destrutiva, criar exceção para revisão humana.
5. Registrar ator, origem, antes/depois, tentativa, resultado e correlação.
6. Encerrar somente depois de nova leitura confirmar convergência ou de uma
   exceção documentada declarar por que os estados permanecerão diferentes.

## Regra para novas integrações

Nenhum adaptador novo pode entrar em piloto sem acrescentar ao seu contrato:

- os campos que lê e escreve;
- a fonte canônica de cada campo;
- a chave de idempotência e a semântica de reordenação;
- a retenção, paginação, limites e atraso esperado;
- a forma de reconciliar o estado depois de cada mutação;
- as limitações que ainda obrigam uso do portal externo.

Conexão OAuth, chamada bem-sucedida ou presença de token provam apenas acesso.
Não provam cobertura do domínio, sincronização, conciliação nem completude.
