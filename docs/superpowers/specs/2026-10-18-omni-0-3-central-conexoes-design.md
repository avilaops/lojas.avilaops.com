# OMNI-0.3 — Central de Conexões e Saúde dos Canais

<!-- markdownlint-disable MD013 -->

## Intenção

Dar ao lojista uma única tela para descobrir se cada canal está realmente pronto para operar, o que sincronizou por último, o que está atrasado e qual ação resolve o problema. “Conectado” continua sem significar “completo”.

## Escopo

A Central cobre Mercado Livre, Amazon, Shopee, Magalu, Melhor Envio, todas as credenciais de pagamento configuradas em `CredencialPagamento` — incluindo a compatibilidade legada do Mercado Pago — e webhooks da API. Ela lê o estado da loja e das filas já existentes, sem copiar tokens ou transformar um retrato derivado em nova fonte canônica.

Cada linha apresenta:

- estado operacional (`saudavel`, `atencao`, `erro`, `desconectado` ou `indisponivel`);
- conta conectada e forma de autenticação, sem segredos;
- capacidades e escopos realmente implementados;
- última atividade ou sincronização confirmada, atraso e prazo esperado;
- saúde dos webhooks e erros acionáveis;
- ações de testar, conectar ou reconectar, conforme o canal;
- histórico imutável de testes e mudanças de conexão.

## Fonte do estado

- Mercado Livre: credencial do tenant, expiração, maior `sincronizadoEm` dos anúncios e rotina `mercadolivre.rodar`.
- Amazon, Shopee e Magalu: `ContaCanal`, validade do acesso/refresh e o fato explícito de que hoje são somente conexão.
- Mercado Pago: credencial ativa/legada, último teste e rotina de renovação.
- Melhor Envio: credencial do tenant e validade do acesso.
- Webhooks da API: configuração, falhas seguidas, filas pendentes/esgotadas e última entrega.

Ausência de atividade em um canal que ainda não implementa operações de domínio não será chamada de atraso. O estado mostra “somente conexão” e a limitação correspondente.

## Regras de classificação

O pior sinal prevalece: `erro`, `atencao`, `saudavel`, `desconectado` e `indisponivel`. `Indisponivel` significa que a plataforma não tem o aplicativo necessário e a loja ainda não possui conexão; uma conexão existente nunca é escondida por falta de configuração nova.

| Sinal | Classificação |
| --- | --- |
| Credencial incompleta, refresh vencido, teste falho ou webhook desligado por falhas | `erro` |
| Token vence dentro da margem de renovação, rotina relacionada falhando ou atividade além de duas cadências | `atencao` |
| Credencial íntegra e atividade dentro da expectativa | `saudavel` |
| Credencial ausente com aplicativo disponível | `desconectado` |
| Credencial ausente e aplicativo indisponível | `indisponivel` |

Mercado Livre espera atividade em até duas horas somente quando há anúncio publicado/pausado; loja sem anúncio não acumula atraso. Pagamentos usam o último teste da credencial e a rotina diária de renovação quando OAuth. Webhooks agregam o pior estado, exibem contagens e entram em atenção quando a entrega pendente mais antiga passa de cinco minutos. Amazon, Shopee e Magalu não possuem SLA de sincronização enquanto forem somente conexão.

## Histórico e teste

`EventoSaudeCanal` guarda somente fatos operacionais sanitizados: canal, tipo, resultado, código/mensagem de uma allowlist, ator e instante. Canal, tipo, resultado, ator e mensagem têm limites no banco; `UPDATE` e `DELETE` são bloqueados por trigger. O histórico fica retido sem expurgo automático até a política global do OMNI-5.5 definir o prazo legal. Não guarda token, corpo de webhook, URL, `cause` ou resposta bruta do provedor.

O teste é uma ação autenticada e autorizada no backend. Para canais com operação implementada, ele valida a credencial contra o provedor com timeout. Para canais somente conexão, valida autorização/renovação disponível e deixa explícito que não testa catálogo ou pedidos. A renovação reutiliza o caminho existente, que persiste o novo par imediatamente; nunca testa um refresh rotativo sem salvá-lo. Uma reserva imutável com chave por tenant/canal/minuto limita a uma execução a cada 60 segundos e impede concorrência entre processos. Todo resultado, inclusive falha, entra no histórico como novo evento; nenhuma linha anterior é atualizada.

## Design da interface

### Direção

A Central se parece com uma mesa de operação: densa, calma e legível, usando a linguagem visual já existente no painel. A cor comunica estado, nunca decoração.

### Tokens

- Base: `#f8fafc` e branco.
- Texto: `#0f172a`; secundário: `#475569`.
- Saudável: `#047857`; atenção: `#b45309`; erro: `#b91c1c`; inativo: `#64748b`.
- Tipografia: a família já carregada pelo painel, com números tabulares para horários e contagens.
- Bordas e raios seguem os tokens existentes; sem gradiente ou sombras decorativas.

### Estrutura

```text
Central de conexões                         Atualizado agora
[ 3 saudáveis ] [ 2 precisam de atenção ] [ 2 desconectados ]

Precisa de ação
┌ status │ Canal        │ Última atividade │ problema       │ ação ┐
│ erro   │ Mercado Pago │ há 18 min         │ teste falhou   │ testar│
└────────┴──────────────┴───────────────────┴────────────────┴───────┘

Todas as conexões
┌ linha expansível: identidade, escopos, webhooks, atraso e histórico ┐
└──────────────────────────────────────────────────────────────────────┘
```

No celular, cada linha vira um bloco vertical com o estado e a ação visíveis sem abrir os detalhes. Alvos de toque têm pelo menos 44 px, conteúdo longo quebra linha e não existe rolagem horizontal.

## Segurança e permissão

- A leitura é disponível a qualquer operador autenticado e respeita o tenant atual.
- Testar e reconectar exigem a permissão `configuracoes` no backend.
- Nenhuma resposta contém token, segredo, URL assinada ou erro bruto sensível.
- A abertura da página não faz chamadas externas; somente a ação explícita “Testar conexão” consulta o provedor.
- Toda busca filtra `tenantId` antes de acessar ou decifrar uma credencial; canal desconhecido e IDs de outro tenant fecham com erro sem consulta externa.

## Não objetivos

- Implementar catálogo, pedidos ou sincronização de canais que hoje são somente conexão.
- Criar o motor comum de filas, que pertence ao OMNI-0.4.
- Corrigir divergências automaticamente, que pertence ao OMNI-0.5.
- Alterar ou executar workflows n8n.

## Critérios de aceite

- Estado real por loja e canal, incluindo disponibilidade, escopos e limitações.
- Última sincronização/atividade, atraso esperado, webhooks e erros acionáveis.
- Ações seguras de testar e de conectar/reconectar.
- Histórico persistente, sanitizado e isolado por tenant.
- Alertas operacionais aparecem primeiro e apontam para o contexto exato.
- Desktop e celular validados visualmente, sem rolagem horizontal.
