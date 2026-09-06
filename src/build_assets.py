"""Downscale the NASA maps and pack them as base64 data URIs into assets.js (loaded inline by the page)."""
import base64, io, json, os
from PIL import Image, ImageFilter, ImageEnhance

SRC = os.path.join(os.path.dirname(__file__), 'tex')
out = {}
total = 0

def pack(name, im, size, q=78, mode='RGB'):
    global total
    im = im.convert(mode)
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q, optimize=True, progressive=False)
    b = buf.getvalue(); total += len(b)
    out[name] = 'data:image/jpeg;base64,' + base64.b64encode(b).decode()
    print(f'{name:10s} {size[0]}x{size[1]} {len(b)/1024:7.0f} KB')

def load(f): return Image.open(os.path.join(SRC, f))

# Earth: NASA Blue Marble (day), Black Marble city lights (night, base removed), water mask for ocean specular
pack('earth', load('tg_earth-blue-marble.jpg'), (4096, 2048), q=70)
night = load('tg_earth-night.jpg').convert('RGB')
# the Black Marble render has a dark-blue ocean base; keep only the lights
r, g, b = night.split()
lum = Image.merge('RGB', (r, g, b)).convert('L')
lights = lum.point(lambda v: 0 if v < 34 else min(255, int((v - 34) * 1.9)))
pack('night', lights, (2048, 1024), q=70, mode='L')
water = load('tg_earth-water.png').convert('L')
pack('water', water, (1024, 512), q=70, mode='L')
# Moon (three.js lunar map)
pack('moon', load('tj_moon_1024.jpg'), (1024, 512), q=82)
# Planets from NASA 3D Resources
pack('mars', load('mars.jpg'), (1440, 720), q=76)
pack('venus', load('venus.jpg'), (1440, 720), q=74)
pack('jupiter', load('jupiter.jpg'), (720, 360), q=82)
pack('saturn', load('saturn.jpg'), (720, 360), q=82)
pack('neptune', load('neptune.jpg'), (720, 360), q=80)
pack('pluto', load('pluto.jpg'), (720, 360), q=78)
pack('mercury', load('threex_mercurymap.jpg'), (1024, 512), q=74)
# Moons
for m in ['phobos','deimos','io','europa','ganymede','callisto','mimas','enceladus','tethys','dione','rhea','titan','iapetus','miranda','ariel','umbriel','titania','oberon','triton','charon']:
    im = load(m + '.jpg')
    w = 720 if im.size[0] >= 720 else im.size[0]
    pack(m, im, (w, w // 2), q=72)
# Star map (Tycho) — boosted so the Milky Way reads, softened so the resampled stars don't turn into blobs
# only the Milky Way's soft glow is wanted from this map — the crisp stars come from the point sprites
st = load('stars.jpg').convert('RGB').resize((2048, 1024), Image.LANCZOS)
st = st.point(lambda v: min(255, int(255 * (v / 255) ** 0.7)))
st = st.filter(ImageFilter.GaussianBlur(5))
st = st.point(lambda v: min(255, int(v * 0.75)))
pack('stars', st, (1024, 512), q=70)

with open(os.path.join(os.path.dirname(__file__), 'assets.js'), 'w') as f:
    f.write('window.TEX=' + json.dumps(out) + ';')
print(f'\nTOTAL raw {total/1048576:.2f} MB  → base64 ≈ {total*4/3/1048576:.2f} MB')
