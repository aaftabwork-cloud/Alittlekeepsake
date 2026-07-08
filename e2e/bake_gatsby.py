#!/usr/bin/env python3
"""Bake the exported Invite Studio JSONs into a standalone GSAP scroll invite.
Reads: e2e/exports/gatsby-final.project.json (bands) + gatsby-final-layout.json (objects).
Writes: public/e2e-bake/gatsby.html (+ vendored gsap) — the 'pipeline reads it back' step."""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E2E = os.path.join(ROOT, 'e2e')
OUT_DIR = os.path.join(ROOT, 'public', 'e2e-bake')
VENDOR_SRC = os.path.expanduser('~/Documents/wedding-invite-access-copy/heritage/vendor')
os.makedirs(OUT_DIR, exist_ok=True)
for lib in ('gsap.min.js', 'ScrollTrigger.min.js'):
    shutil.copy(os.path.join(VENDOR_SRC, lib), os.path.join(OUT_DIR, lib))

project = json.load(open(os.path.join(E2E, 'exports', 'gatsby-final.project.json')))
layout = json.load(open(os.path.join(E2E, 'exports', 'gatsby-final-layout.json')))
bands = project['bands']
W = 390
TOTAL = sum(b['height'] for b in bands)

def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

band_divs = []
y = 0
for b in bands:
    bg = f"background-image:url('{b['bg']}');" if b.get('bg') else ''
    band_divs.append(
        f"<div class='band' id='band-{b['id']}' style=\"top:{y}px;height:{b['height']}px;"
        f"background-color:{b.get('color', '#000')};{bg}\"></div>")
    y += b['height']

obj_divs = []
for i, o in enumerate(layout):
    a = o.get('anim') or {}
    name = a.get('name', '') if isinstance(a, dict) else str(a)
    dur = a.get('dur', 1) if isinstance(a, dict) else 1
    common = f"data-anim='{name}' data-dur='{dur}'"
    if o['type'] == 'text':
        cs = o.get('charSpacing', 0) / 1000.0
        style = (
            f"left:{o['x']}px;top:{o['y']}px;width:{o.get('w', 320)}px;"
            f"font-size:{o['fontSize']}px;font-family:{o['fontFamily']};color:{o['fill']};"
            f"text-align:{o.get('textAlign', 'left')};font-style:{o.get('fontStyle', 'normal')};"
            f"font-weight:{o.get('fontWeight', '400')};letter-spacing:{cs}em;"
            f"line-height:{o.get('lineHeight', 1.16)};opacity:{o.get('opacity', 1)};"
            f"mix-blend-mode:{(o.get('blend') or 'normal').replace('source-over', 'normal')};")
        obj_divs.append(f"<div class='obj text' {common} style=\"{style}\">{esc(o['text'])}</div>")
    elif o['type'] == 'img':
        style = (
            f"left:{o['x']}px;top:{o['y']}px;width:{o['w']}px;height:{o['h']}px;"
            f"opacity:{o.get('opacity', 1)};"
            f"mix-blend-mode:{(o.get('blend') or 'normal').replace('source-over', 'normal')};")
        obj_divs.append(f"<img class='obj' {common} style=\"{style}\" src=\"{o['src']}\">")

html = f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Abdullah &amp; Sarah — Gatsby Nights</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400&display=swap" rel="stylesheet">
<style>
  html, body {{ margin:0; padding:0; background:#0a0a0f; }}
  #scaler {{ transform-origin: top left; }}
  #stage {{ position:relative; width:{W}px; height:{TOTAL}px; overflow:hidden; }}
  .band {{ position:absolute; left:0; width:{W}px; background-size:cover; background-position:center; }}
  .obj {{ position:absolute; will-change:transform,opacity; }}
  .obj.text {{ white-space:pre-wrap; }}
</style>
</head><body>
<div id="scaler"><div id="stage">
{chr(10).join(band_divs)}
{chr(10).join(obj_divs)}
</div></div>
<script src="gsap.min.js"></script>
<script src="ScrollTrigger.min.js"></script>
<script>
gsap.registerPlugin(ScrollTrigger);
const DESIGN_W = {W}, TOTAL_H = {TOTAL};
function fit() {{
  const s = window.innerWidth / DESIGN_W;
  document.getElementById('scaler').style.transform = `scale(${{s}})`;
  document.body.style.height = (TOTAL_H * s) + 'px';
}}
fit(); addEventListener('resize', fit);

document.querySelectorAll('.obj').forEach(el => {{
  const anim = el.dataset.anim, dur = parseFloat(el.dataset.dur || '1');
  if (!anim) return;
  const st = {{ trigger: el, start: 'top 88%', toggleActions: 'play none none none' }};
  if (anim === 'reveal-up') {{
    gsap.from(el, {{ y: 26, autoAlpha: 0, duration: dur, ease: 'power2.out', scrollTrigger: st }});
  }} else if (anim === 'reveal-soft') {{
    gsap.from(el, {{ autoAlpha: 0, scale: 0.985, duration: dur, ease: 'power1.out', scrollTrigger: st }});
  }} else if (anim === 'twinkle') {{
    gsap.to(el, {{ opacity: 0.35, duration: dur / 2, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: Math.random() }});
  }} else if (anim === 'breathe') {{
    gsap.to(el, {{ scale: 1.04, duration: dur / 2, ease: 'sine.inOut', repeat: -1, yoyo: true }});
  }} else if (anim === 'bob') {{
    gsap.to(el, {{ y: '+=8', duration: dur / 2, ease: 'sine.inOut', repeat: -1, yoyo: true }});
  }} else if (anim === 'float-drift') {{
    gsap.to(el, {{ x: '+=10', y: '-=14', duration: dur, ease: 'sine.inOut', repeat: -1, yoyo: true }});
  }}
}});
window.__baked = true;
</script>
</body></html>"""

out = os.path.join(OUT_DIR, 'gatsby.html')
open(out, 'w').write(html)
print('baked', out, f'({len(html)//1024}KB html, {len(layout)} objects, {len(bands)} bands, total {TOTAL}px)')
