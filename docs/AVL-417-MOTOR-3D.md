# AVL-417 — decisão de integração do visualizador MRG

Data: 03/11/2026. Autor: agente Codex, engenharia AVL-417.
Estado: análise arquitetural concluída; implementação do novo visualizador pendente.
Issue: https://linear.app/avilaops/issue/AVL-417/mrg-adotar-motor-3d-detalhado-no-configurador-sob-medida

## Escopo e evidência

Esta entrega atende à comparação arquitetural exigida antes da escolha.
Não comprova renderização, aprovação visual, testes, CI ou publicação do novo modelo.

O projeto Lojas no Linear aponta para `avilaops/lojas.avilaops.com`.
A AVL-417 estava In Progress, sem comentários, subtarefas ou bloqueios formais.
AVL-400, AVL-401 e AVL-403 estavam Done. Seus comentários também foram consultados.
Nenhum PR estava aberto em Lojas na consulta. As buscas no Linear por
“motor 3D” e “isolamento” não identificaram uma entrega separada de família MRG
ou catálogo industrial nos resultados retornados.

Fontes clonadas e inspecionadas em seus commits:

| Repositório | Commit |
| --- | --- |
| Lojas | `45fe4cff9dec3d032f16a8215566044c384cd125` |
| Ludus | `d0d32abf91ef4db936530e1fc96baa56d3e5fd9c` |
| motor-web | `42aa9a42c8959b4d11ddc1c816857808428c98b0` |
| gerador-3d | `8adbd37fca14d59fc281e209acbfe6652109d05e` |

Os caminhos nas seções seguintes são relativos a esses repositórios.
As conclusões descrevem esses snapshots, sem afirmar o comportamento em produção.

## Comparação arquitetural

| Implementação | Contrato e execução | Reutilização na MRG |
| --- | --- | --- |
| Lojas, `src/app/configurador/ConfiguradorClient.tsx` | Next.js 16, React 19; seis faces CSS, dimensões normalizadas com mínimos visuais, sliders de rotação | Manter estado canônico e fluxo de solicitação; substituir somente o componente de apresentação |
| Ludus, `src/components/Viewer3D.astro` | Astro; spec serializado; import dinâmico do viewer quando próximo da viewport; Three.js | Reutilizar carregamento sob demanda e viewer; componente Astro não é diretamente componente React |
| motor-web, `src/conteudo.rs` e `src/tipos.rs` | Crate Rust; `Modelo3d` contém URL GLB, alternativa iOS e texto; gera elemento `modelo-3d` | Serve conteúdo de modelos existentes; não implementa câmera, WebGL ou geração paramétrica da caixa |
| gerador-3d, `src/generate.ts`, `src/spec/schema.ts` e `src/viewer/EquipmentViewer.ts` | TypeScript, Three.js 0.149.0, Zod 4; gera grupos, articulações, envolvente e projeção; viewer com OrbitControls | É a base adequada para reutilizar iluminação, materiais e gestos, mas precisa de contrato compatível com caixa térmica |

Ludus fixa `@avilaops/gerador-3d` no commit abreviado `ee94140` em
`package.json`; o HEAD inspecionado do gerador é outro commit.
Não assumir que a versão instalada na Ludus tem todas as APIs do HEAD atual.

O gerador exporta `./viewer` e `./viewer/react` em `package.json`.
Seu wrapper React recebe `EquipmentSpecInput`, cria o viewer no efeito,
atualiza o modelo e chama `dispose()` ao desmontar.
A origem fica no piso, Y aponta para cima, X é largura e Z é profundidade.

## Limites confirmados do motor compartilhado

`FAMILY_IDS` e `families/registry.ts` contêm apenas:

- `selectorized-tower`;
- `plate-loaded-lever`;
- `bench`;
- `rack`;
- `cable-station`;
- `leg-press`.

Não há família caixa térmica nem função pública de registro de família.
`generateEquipment` valida o enum antes de buscar o construtor.
Adicionar apenas `params` não cria uma nova família.

`EquipmentViewer.setEquipment` também aceita um `GeneratedEquipment`
pré-construído. Essa alternativa existe e não foi descartada por falta de API.
Porém, o objeto ainda exige `spec: EquipmentSpec`, com o enum de academia,
e `footprint.trainingArea`. O viewer constrói overlays de área de treino,
pessoa e medidas mesmo com a barra escondida. Usar `family: "rack"` ou uma
asserção de tipo para disfarçar a caixa preservaria uma semântica incorreta.

Decisão técnica proposta: reutilizar o viewer do gerador e introduzir nele
um contrato de modelo visual independente de famílias de academia.
Manter o gerador paramétrico da caixa e o adaptador de configuração em Lojas,
sem duplicar câmera, iluminação e controles. Essa mudança no repositório
compartilhado deve ser coordenada na AVL-417 antes de editar outro produto.

Alternativa válida: adicionar uma família própria de caixa térmica ao gerador,
com contrato, testes e revisão do pacote. Tem alcance maior e continua exigindo
a remoção ou desativação efetiva dos overlays específicos de academia.
Uma implementação Three.js independente em Lojas é tecnicamente possível,
mas duplicaria o motor que a issue pede para compartilhar.

## Contrato da MRG e lacuna industrial

`src/lib/configurador-sob-medida.ts` define contrato v1 com dimensões,
material externo, acabamento, tampa, mobilidade, divisórias, quantidade e
observações. Dimensões aceitam inteiros de 20 a 300 cm; esses limites são do
editor, não aprovação industrial.

Não existem campos tipados de isolamento, fechos, dobradiças, alças,
espessura das paredes ou personalização. O comentário da AVL-400 de
31/10/2026, ID `748c4ffb-bbad-44f3-87e3-ff9fd50869bb`, registra que
fechos, alças, isolamento e personalização não viraram opções fechadas porque
as combinações industriais não foram fornecidas. Observações capturam a
necessidade sem inventar regra.

Isso bloqueia o aceite integral de isolamento/ferragens sincronizados com a
ficha, não toda melhoria visual dos campos existentes. Uma aparência
conceitual pode ser implementada, desde que sua geometria ilustrativa não
seja apresentada como espessura, capacidade, acessório escolhido ou desenho
liberado para fabricação.

Não extrair especificações automaticamente de observações: a retomada retorna
esse campo vazio por segurança e ele pode conter dados pessoais.

## Fronteira de integração proposta

Fluxo preservado:

`estado do editor → configuração validada → solicitação → snapshot da ficha`

Projeção visual separada:

`campos técnicos da configuração → adaptador MRG → modelo → viewer`

O viewer não escreve na configuração e não escolhe tenant, referência,
chave de retomada, quantidade ou propriedades industriais.

| Campo canônico | Projeção visual proposta |
| --- | --- |
| `larguraCm` | X, converter cm para metros dividindo por 100 |
| `alturaCm` | Y, converter cm para metros dividindo por 100 |
| `profundidadeCm` | Z, converter cm para metros dividindo por 100 |
| `materialExterno` e `acabamento` | Aparência distinta, sem criar liga, cor comercial ou propriedade física não cadastrada |
| `tampa` | Superior, frontal ou dupla; abertura para inspeção é estado visual temporário |
| `mobilidade` | Pés, rodízios ou sem base elevada |
| `divisorias` | Contagem sincronizada; disposição ilustrativa explicitada |
| `quantidade` | Continua na ficha; não multiplicar malhas por quantidade |
| `observacoes` | Não enviar ao motor nem usar como entrada de geometria |

Câmera, zoom, tampa aberta e corte ilustrativo não pertencem ao payload salvo.
Medidas vazias, intermediárias, não finitas ou fora do contrato devem manter
fallback textual, sem alterar silenciosamente a medida digitada.

## Preservação da ficha e retomada

`src/lib/solicitacoes-sob-medida.ts` valida a entrada no servidor, cria a
ficha a partir da mesma configuração e persiste snapshot e versões.
A retomada usa chave privada por POST, hash e busca por tenant/referência;
retorna somente os dados técnicos, com observações vazias.

`src/lib/ficha-tecnica-sob-medida.ts` congela contrato e rótulos v1.
A prévia persistida é SVG determinístico derivado da ficha, não captura
WebGL do navegador. Alterar o viewer não deve reinterpretar snapshots v1
nem substituir a prévia histórica por uma captura recebida do cliente.

Se a MRG fornecer novos campos industriais, será necessária evolução
versionada de configuração/ficha e compatibilidade explícita da retomada.
Não adicionar defaults industriais retroativos a solicitações existentes.

## Carregamento, falhas e acessibilidade

O componente Next deve importar o viewer apenas no cliente e sob demanda,
mantendo resumo e formulário disponíveis durante carregamento e falha.
O wrapper precisa cancelar atualizações após desmontagem, liberar o modelo
anterior e chamar `dispose()` do viewer. Modelos passados prontos continuam
sendo propriedade do chamador segundo `setEquipment`.

No snapshot do gerador, a criação do renderer captura falha WebGL e mostra
mensagem. Não foi encontrado tratamento de `webglcontextlost` no viewer.
A integração deve cobrir perda de contexto, falha do chunk e retomada de
configuração durante import assíncrono, além do caso de WebGL ausente.

OrbitControls já fornece rotação e pinça, e o canvas usa `touch-action: none`.
A área de toque deve ficar limitada ao palco para permitir rolagem fora dele.
Disponibilizar botões focáveis para vistas e zoom, resumo textual e estado
de carregamento anunciado. Respeitar preferência de movimento reduzido.

Não copiar literalmente o catch da Ludus: ele procura `.v3d-ph` depois de
`replaceChildren()`; uma falha posterior à remoção pode deixar esse seletor
nulo. Esta observação é estática; não foi reproduzida em navegador.

## Verificação exigida para a implementação

| Evidência | Casos mínimos | Estado nesta rodada |
| --- | --- | --- |
| Comparação de arquitetura | Quatro fontes e commits; APIs e contratos lidos | Concluída por inspeção |
| Geometria | Dimensões nos extremos; todos os tipos de tampa/base; divisórias 0 e 10; ausência de NaN; descarte | Não executada |
| Sincronização | Editar, salvar, retomar e comparar campos com ficha; preservar origem e v1 | Não executada |
| Falhas | WebGL ausente/perdido, chunk rejeitado, desmontagem durante carga | Não executada |
| Mobile e teclado | Rotação, pinça, scroll externo, foco, vistas, zoom e resumo | Não executada |
| Regressão | Testes existentes, TypeScript, lint, build, integração PostgreSQL | Não executada |
| CI | SHA, run e artefatos de navegador associados ao mesmo código | Não executada |

AGENTS.md determina builds e testes somente no GitHub CI.
O projeto Linear exige jobs de no máximo 90 segundos, usando
`timeout-minutes: 1`. O workflow existente ainda declara limites de
10, 20, 45 e 15 minutos; a divergência é preexistente e não foi alterada.
Não declarar conformidade com essa política nem disparar a validação integral
sem resolver sua execução dentro do limite.

O workflow de merge automático ignora drafts e publica main após merge.
Uma futura proposta de código deve permanecer draft enquanto faltarem
coordenação, critérios e autorização de publicação.

## Investigação e menor desbloqueio

Consultas executadas: get_issue, get_project com recursos, list_comments,
list_issues por parent e palavras-chave; gh repo view/pr list; git clone,
git rev-parse HEAD; rg e leitura dos arquivos acima.
A busca integrada GitHub por “three” retornou vazio; clones autenticados
permitiram inspecionar as fontes. get_agent_context retornou
`Tool get_agent_context not found`; o contexto foi recuperado por projeto,
issues, comentários e código.

Entrega desta rodada: documento de comparação, decisão de integração e
registro da demanda. Nenhum código runtime, dependência, banco, regra
industrial ou ambiente de produção foi alterado.

Menor próximo passo técnico: coordenar na AVL-417 uma alteração de
`gerador-3d` que aceite um modelo visual neutro e omita overlays de academia,
com versão fixada e teste do consumidor Lojas. Isso libera a integração dos
campos já persistidos sem falsificar uma família.

Para o aceite integral: vincular à issue as opções industriais aprovadas
pela MRG ou uma decisão explícita de que isolamento/ferragens serão somente
ilustrações sem configuração técnica nesta entrega. A falta desses dados
não deve ser tratada como falha de autenticação ou impossibilidade técnica
de desenhar uma caixa.
