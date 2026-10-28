# Contratos de Lojas e Experiments

## Escopo desta entrega

Primeiro incremento da [AVL-343](https://linear.app/avilaops/issue/AVL-343),
relacionado a OMNI-0 e OMNI-3.5 do
[Lojas 360](https://linear.app/avilaops/document/175d6093-f313-4b77-be7c-33eb5ebd1f72).
O workflow existente gera evidência antes de liberar o build da imagem.

O analisador AST é reutilizado de `avilaops/experiments`, commit
`fb2262d1e30575a466b81fd91be323e931f43164`. Não há pacote publicado,
dependência de runtime, chamada ao laboratório ou execução dos módulos da aplicação.
O job usa Node 24 conforme o manifesto de Experiments; a aplicação segue Node 22.

## Baseline e decisão

Em PR, o baseline é o SHA da base informado pelo evento e o candidato é o
checkout do merge usado pelo GitHub. Em push/manual, ambos usam o SHA atual:
essas execuções capturam o estado e não demonstram compatibilidade com a release anterior.
Atualizações incompatíveis da API v1 exigem preservar a operação ou definir
uma nova versão e migração em outra entrega; não existe bypass neste gate.

O gate recusa remoção de caminho/método explícito em `/api/v1`, exportação
identificada como não funcional, erro sintático e conflitos de padrões públicos.
Renomear parâmetro também é mudança do contrato exportado.
Uma rota catch-all não substitui operações específicas removidas.

Factories como `rotaDaApi` e funções importadas permanecem `needs_review`.
São preservadas no comparativo pelos métodos declarados, sem afirmar que
sejam chamáveis. Adições não quebram o gate e aparecem no relatório.
Baseline ou candidato sem operações públicas é erro, nunca aprovação vazia.

## Artefatos e limites

O artefato `lojas-contracts-<sha>` contém `baseline.json`, `inventory.json` e
`compatibility.json`, ou diagnóstico seguro em caso de falha de captura.
O inventário usa `route-inventory/2`, importável no produto `lojas` pelo
laboratório privado, com revisão/ETag e autorização próprios. Este CI não importa
nem publica automaticamente conteúdo no laboratório.

Cada captura contém páginas, handlers, hashes de fonte, commit, ferramentas,
pendências e `verification: not_run`. Duas varreduras detectam alterações nos
intervalos observados; não constituem snapshot atômico. O fingerprint cobre
somente os arquivos de rota/página, não seus helpers e componentes importados.

Este gate não exporta OpenAPI nem valida schemas de payload, escopos,
isolamento por tenant, consumidores, efeitos, semântica fiscal ou execução real.
Esses itens continuam pendentes da AVL-343 e dos pilotos correspondentes.
Não se transforma descoberta sintática em certificação funcional.

Build, lint, tipos, testes da aplicação e integração PostgreSQL permanecem
nos jobs existentes do GitHub CI. Nenhum teste ou build é executado no servidor.
