# Operações comerciais do catálogo

`agrupar-apresentacoes-domirio.sql` preserva integralmente o trabalho do PR
#208. Reorganiza sete famílias de produtos da Domi-Rio e mantém suas barreiras
de SKU, reservas, grade e referências B2B. Não faz parte do deploy automático
da plataforma: a execução deve acompanhar a confirmação do agrupamento e o
backup/conferência dos dados daquela loja.

Em 05/11/2026, a produção na revisão `2b8d622` não tinha aplicado a migração
`20261105140000_converter_demais_apresentacoes_domirio_variantes`. Ela foi
separada antes de publicar a busca por marca da Vedashow. A migração anterior
de CYPERTRYNE permanece no histórico, já aplicada e validada.

Não repetir a operação em ambiente que já tenha reorganizado essas famílias.
