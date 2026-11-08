# Capas próprias para os artigos da Domi-Rio

## Objetivo e decisão

O proprietário pediu novas imagens para os artigos com capas repetidas.
Manter a primeira ocorrência de cada uma das sete imagens originais e gerar
43 imagens editoriais novas, uma para cada artigo restante. Cada imagem deve
representar seu assunto e funcionar tanto no card como no cabeçalho do artigo.

## Execução

- [x] Inventariar as repetições e definir 43 cenas distintas por artigo.
- [x] Gerar uma imagem por chamada da ferramenta integrada `image_gen`.
- [x] Salvar todas as selecionadas no projeto e otimizar em WebP pelo Sharp.
- [x] Revisar visualmente as imagens e atualizar capa e texto alternativo.
- [ ] Verificar 50 URLs e hashes distintos no teste de integridade da CI.
- [x] Carregar versões responsivas e sob demanda nos cards.
- [ ] Conferir desktop, mobile e publicação em produção.

## Restrições

- Usar a ferramenta integrada; sem fallback silencioso para API ou CLI.
- Fotografia editorial rural, sem marcas, textos, dosagens ou falsa interface.
- Não criar imagens de aplicações inseguras nem apresentar imagens como
  evidência científica de identificação de praga, registro ou eficácia.
- Não alterar os artigos, seus slugs, ordem ou fontes.
- Preservar originais; gerar arquivos novos por slug.
- Builds e testes somente na CI. Inspeção visual e leitura HTTP locais permitidas.

## Evidências

O plano operacional e o resultado de cada geração ficam em
`.work/domirio-capas-plano.json` e `.work/domirio-capas-resultados.json`.
O conjunto de prompts será versionado com os caminhos e hashes dos arquivos
finais, sem depender das imagens salvas no diretório pessoal do gerador.
O manifesto está em `docs/assets/domirio-capas-geradas.json`.
