# Upscale CPU — Ávila Ops

Worker de inferência ONNX, sem Redis/BullMQ. Amplia imagens 4x, uma por vez.

## Requisitos
Python com onnxruntime (CPU), Pillow e NumPy; modelo ONNX verificado. Exige CPU e memória disponíveis. O teste anterior usou um arquivo de modelo validado por SHA-256; não copie modelos de fontes não verificadas.

## Instalação segura
1. Preparar venv e modelo fora da pasta temporária, somente após liberar disco e validar recursos.
2. Criar token aleatório (32+ bytes), armazenado em segredo do worker e do backend Next.js.
3. Executar como usuário não privilegiado, com systemd, MemoryMax e CPUQuota, apenas na interface de loopback.
4. Se worker e Next.js estiverem em containers separados, usar rede interna isolada. Não publicar a porta 3391.
5. Configurar no backend: `LOJAS_UPSCALE_WORKER_URL=http://worker:3391/upscale` e `LOJAS_UPSCALE_WORKER_TOKEN`.
6. Testar health, 401 sem token, 413 para arquivo grande, 422 para imagem inválida, 429 sob concorrência e imagem 4x.
7. Habilitar o botão no painel apenas depois de testar a implantação.

## Limites iniciais
2 MB de entrada, PNG/JPEG/WebP, até 512x512 e 262144 pixels, uma inferência simultânea. A saída é WebP 4x. Não há processamento em blocos nesta primeira versão; ampliar limites requer testes de RAM. O original permanece preservado; o resultado é novo arquivo no volume da loja.

## Segurança e operação
Não registrar conteúdo ou token; sem URL arbitrária de imagem; upload autenticado pelo painel e segregado por tenant. O endpoint de health deve permanecer privado. Monitorar memória e disco. Rollback: remover variáveis do backend e parar worker. Não publicar antes dos testes e da revisão de implantação.

## Ensaios reais em CPU (02/11/2026)

Servidor de teste: Ubuntu 26.04, 2 vCPU, 3,7 GiB RAM, 93% de disco ocupado; ONNX Runtime 1.31.1 com 1 thread. As entradas foram padrões sintéticos e o tempo abaixo é **somente inferência**, não upload HTTP, compressão ou persistência.

| Entrada | Saída | Inferência | RSS máximo |
| --- | --- | ---: | ---: |
| 32×32 | 128×128 | 0,12 s (com inicialização) | ~81 MiB |
| 256×256 | 1024×1024 | 4,60 s | ~134 MiB |
| 512×512 | 2048×2048 | 14,94 s | ~320 MiB |

O teste 512×512 terminou com código 0, mas isso **não autoriza habilitar em produção** com o disco acima de 90%. Executar `python -m unittest discover -s workers/upscale-cpu -p 'test_server.py' -v` no ambiente com modelo e dependências; os 5 testes HTTP passaram no servidor de teste. Verificar fotos reais, picos de carga, limites de memória, segredos e deploy antes de liberar a feature.
