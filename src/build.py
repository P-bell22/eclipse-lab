import os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'eclipse-lab.src.html'), encoding='utf-8').read()
assets = open(os.path.join(here, 'assets.js'), encoding='utf-8').read()
astro = open(os.path.join(here, 'vendor/astronomy.browser.min.js'), encoding='utf-8').read()
bessel = open(os.path.join(here, 'bessel.js'), encoding='utf-8').read() + '\n' + open(os.path.join(here, 'bessel_data.js'), encoding='utf-8').read()
src = src.replace('/*SIMPLE_JS*/', open(os.path.join(here, 'simple.src.js'), encoding='utf-8').read())
body = src.replace('<!--ASSETS-->', '<script>' + astro + '\nwindow.Astronomy=window.Astronomy||(typeof Astronomy!=="undefined"?Astronomy:undefined);</script>\n<script>' + bessel + '</script>\n<script>' + assets + '</script>')
html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>')
out = os.path.join(here, '..', 'index.html')
open(out, 'w', encoding='utf-8').write(html)
print(f'built index.html: {len(html)/1048576:.2f} MB')
