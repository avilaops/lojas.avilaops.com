"""Confere dimensões e decodifica as barras dos PDFs reais do QA, a 203 dpi.

Dependências de QA: pip install pymupdf pillow zxing-cpp
Executar depois de scripts/qa-etiquetas.mts.
"""

from pathlib import Path
import re

import fitz
from PIL import Image
import zxingcpp

PASTA = Path(__file__).resolve().parent.parent / "output/playwright/etiquetas"

for nome, paginas, largura, altura, contagens in [
    ("a4.pdf", 1, 210, 297, [3]),
    ("termica.pdf", 3, 100, 50, [1, 1, 1]),
    ("gtin.pdf", 1, 100, 50, [1]),
]:
    with fitz.open(PASTA / nome) as documento:
        assert len(documento) == paginas, (nome, len(documento))
        for indice, pagina in enumerate(documento):
            assert abs(pagina.rect.width * 25.4 / 72 - largura) < 0.5
            assert abs(pagina.rect.height * 25.4 / 72 - altura) < 0.5
            pixels = pagina.get_pixmap(dpi=203)
            imagem = Image.frombytes("RGB", [pixels.width, pixels.height], pixels.samples)
            lidos = [r.text for r in zxingcpp.read_barcodes(imagem)]
            assert len(lidos) == contagens[indice], (nome, indice, lidos)
            texto = pagina.get_text()
            assert "Etiquetas selecionadas" not in texto
            assert "Camiseta de teste" in texto
            if nome == "gtin.pdf":
                # ZXing pode representar UPC-A como EAN-13 com zero inicial.
                assert lidos[0] in ("036000291452", "0036000291452"), lidos
                assert "036000291452" in texto
            else:
                esperados = re.findall(r"V:[a-z0-9]{25}", texto)
                assert sorted(lidos) == sorted(esperados), (lidos, esperados)
            print(f"{nome}, página {indice + 1}: tamanho correto, {len(lidos)} barras decodificadas a 203 dpi")
