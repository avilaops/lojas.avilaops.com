# Categorias compactas Domi-Rio

Proprietário aprovou categorias mais compactas com ícones e espaço para produtos.
Implementação isolada em componente/CSS module. Seis atalhos em linha em telas
largas, três colunas em tablets e duas no celular. Ícones SVG Lucide existentes,
sem requisição de imagens. Nomes e destinos atuais preservados; título em MDX.
Foco de teclado visível, alvo mínimo de 44 px, hover com movimento reduzido respeitado.

- [x] Implementar componente e texto MDX.
- [x] Validar CI e inspecionar produção em 390, 923 e 1440 px.

Alteração visual reversível; sem testes que apenas espelhem marcação/CSS.
Build/lint/tipos e testes existentes somente na CI conforme AGENTS.md.

Commit 18e297c publicado; CI 42683021326 aprovada após repetição completa
por timeout no upload do primeiro build. Inspeção pública nos três tamanhos:
seis destinos preservados, SVGs presentes, sem overflow/erros de página.
Altura do bloco: 390 px de viewport, 402,5 → 282 px; 923 px, 286,5 → 224 px;
1440 px, 296,5 → 194 px. Capturas revisadas em .work/domirio-categorias.
