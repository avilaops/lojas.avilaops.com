# Operações comerciais do catálogo

`agrupar-apresentacoes-domirio.sql` reorganiza as sete famílias do PR #208.
Cada volume recebe a galeria do cadastro de origem e mantém os identificadores
comerciais. O deploy automático fica separado da operação de catálogo.

Antes de executar, confira os SKUs, as fotos de origem e os vínculos B2B e
registre o backup e a aprovação da operação. O script trava as tabelas de itens
e versões B2B durante a transação. Uma família com regra B2B por produto ou
variante de origem referenciada em versão aprovada emite aviso e fica para
revisão comercial. Itens de rascunho por variante acompanham a FK e mantêm
seus IDs e condições comerciais.

Em 05/11/2026, a produção na revisão `2b8d622` não tinha aplicado a migração
`20261105140000_converter_demais_apresentacoes_domirio_variantes`. Ela foi
separada antes de publicar a busca por marca da Vedashow. A migração anterior
de CYPERTRYNE permanece no histórico, já aplicada e validada.

Uma família com histórico da primeira conversão pode receber o reparo de mídia
quando os SKUs, volumes e vínculos ainda correspondem ao agrupamento original.
A recuperação de apresentações desativadas anteriormente exige revisão
comercial. Famílias com registro da revisão v2 são ignoradas em novas execuções.
