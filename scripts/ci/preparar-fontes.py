"""Prepare licensed font assets on GitHub CI; preserve glyphs and metrics."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote
from urllib.request import urlopen

import fontTools
from fontTools.ttLib import TTFont

if os.environ.get('CI') != 'true':
    raise SystemExit('Font preparation is exclusive to GitHub CI')
revision = os.environ.get('FONT_SOURCE_SHA', '')
if not re.fullmatch('[a-f0-9]{40}', revision):
    raise SystemExit('Pinned upstream revision required')
output = Path(sys.argv[1])
output.mkdir(parents=True, exist_ok=False)
root = f'https://raw.githubusercontent.com/google/fonts/{revision}/'


def download(source):
    with urlopen(root + quote(source, safe='/'), timeout=25) as response:
        content = response.read(8 * 1024 * 1024 + 1)
    if len(content) > 8 * 1024 * 1024:
        raise ValueError('Unexpected asset size')
    return content


def sha256(content):
    return hashlib.sha256(content).hexdigest()


manifest = {'schemaVersion': 1, 'repository': 'https://github.com/google/fonts',
            'revision': revision, 'fonttools': fontTools.__version__, 'files': [], 'licenses': []}
assets = [('Inter', 'ofl/inter/Inter[opsz,wght].ttf', 'inter-variable.woff2', [400, 600, 700, 800])]
for weight, name in [(400, 'Regular'), (600, 'SemiBold'), (700, 'Bold'), (800, 'ExtraBold')]:
    assets.append(('Poppins', f'ofl/poppins/Poppins-{name}.ttf', f'poppins-{weight}-normal.woff2', [weight]))
for family, source, destination, weights in assets:
    raw = download(source)
    font = TTFont(io.BytesIO(raw))
    cmap = font.getBestCmap()
    glyphs = font.getGlyphOrder()
    metrics = dict(font['hmtx'].metrics)
    font.flavor = 'woff2'
    target = output / destination
    font.save(target)
    converted = TTFont(target)
    if converted.getBestCmap() != cmap or converted.getGlyphOrder() != glyphs or converted['hmtx'].metrics != metrics:
        raise ValueError('Font conversion changed glyph coverage or metrics')
    content = target.read_bytes()
    if not content.startswith(b'wOF2'):
        raise ValueError('Expected WOFF2')
    manifest['files'].append({'family': family, 'source': source, 'file': destination,
                              'weights': weights, 'sourceSha256': sha256(raw), 'sha256': sha256(content),
                              'bytes': len(content), 'codepoints': len(cmap), 'glyphs': len(glyphs)})
for family in ['inter', 'poppins']:
    content = download(f'ofl/{family}/OFL.txt')
    if b'SIL OPEN FONT LICENSE' not in content:
        raise ValueError('Original license missing')
    name = f'OFL-{family}.txt'
    (output / name).write_bytes(content)
    manifest['licenses'].append({'family': family, 'file': name, 'sha256': sha256(content)})
(output / 'fontes-inter-poppins.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'revision': revision, 'files': len(manifest['files']),
                  'bytes': sum(item['bytes'] for item in manifest['files']), 'glyphs_and_metrics_preserved': True}))
