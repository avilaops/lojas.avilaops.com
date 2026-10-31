# Configurador 3D sob medida — design

**Ticket:** AVL-400

## Objetivo

Permitir que um visitante da MRG descreva visualmente uma caixa térmica sob medida, salve a configuração e envie uma ficha estruturada para orçamento. A configuração é uma intenção comercial; não é desenho técnico liberado para fabricação.

## Decisão

O configurador usa um modelo paramétrico de paralelepípedo em CSS 3D, com rotação e escala visual. Essa solução mantém carregamento rápido, funciona em celulares e não adiciona uma pilha WebGL apenas para seis faces planas.

Alternativas recusadas nesta fase:

- Three.js: boa base para geometrias futuras, mas custo de dependência e bundle sem ganho proporcional para uma caixa retangular.
- Kernel CAD no navegador: adequado para desenho industrial, porém exige regras fabris, tolerâncias e exportadores que a MRG ainda não validou.
- Modelagem livre: permite configurações impossíveis de fabricar e produz pedidos ambíguos.

## Contrato funcional

- A rota `/configurador` existe somente para tenants com o recurso `configurador_sob_medida`.
- O cliente informa largura, altura e profundidade em centímetros, material externo, acabamento, tipo de tampa, mobilidade, divisórias, quantidade e observações.
- O visual responde imediatamente às três dimensões e às escolhas de tampa, mobilidade e divisórias.
- As faixas dimensionais iniciais são limites de entrada do software, não limites fabris. A interface deixa isso explícito.
- Não há cálculo de preço, capacidade útil, peso, isolamento térmico ou viabilidade industrial sem fórmula validada pela fábrica.
- O envio exige nome e ao menos um contato entre e-mail e telefone, aceite de tratamento dos dados e uma configuração válida.
- O servidor resolve o tenant pelo host, revalida toda entrada e grava uma revisão imutável em JSON.
- A resposta devolve uma referência não sequencial. O WhatsApp recebe apenas referência e resumo não sensível.

## Dados

`SolicitacaoSobMedida` pertence ao tenant e contém referência, versão do contrato, estado, dados de contato, configuração JSON, origem e timestamps. A referência é única por tenant e os índices permitem triagem por estado e data.

O JSON preserva o contrato recebido. Mudanças futuras criam nova versão do contrato; não reinterpretam silenciosamente pedidos antigos.

## Segurança e privacidade

- Isolamento por `tenantId` em todas as operações.
- Limite de cinco envios por IP e tenant a cada minuto.
- Campos textuais têm normalização e limites explícitos.
- A consulta pública por referência não expõe PII nesta fase.
- O recurso pode ser desligado globalmente pelo mecanismo existente de flags.

## Acessibilidade e adaptação

O formulário continua funcional sem animação ou suporte a transformações 3D. A representação possui resumo textual equivalente. Controles têm rótulos, mensagens associadas e alvos de toque adequados. A disposição vira uma coluna em telas estreitas.

## Critérios de conclusão

- Domínio paramétrico coberto por testes de limites, normalização e resumo.
- Persistência e migração tenant-safe.
- Rota pública protegida por recurso.
- Envio público validado no servidor, limitado e persistido.
- Visualização responsiva e formulário completo.
- Testes, lint, typecheck e build verdes.

