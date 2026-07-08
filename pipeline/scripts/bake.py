#!/usr/bin/env python3
"""Bake a Craft project/layout JSON into a standalone, animated, scrollable HTML invite.
This is the FINAL render step — run it on the JSON the tool exports after finishing.

    python3 bake.py <project-or-layout.json> <out.html>

- Accepts either shape: full project {name,bands,layout} or the flat engine layout array
  (in which case pass --bands <project.json> too, or it falls back to one full-height band).
- GSAP + ScrollTrigger are inlined so the HTML is a single portable file.
- Asset srcs like /templates/assets/... are rewritten to absolute file paths so the file
  opens directly in a browser. Animation presets map to the tool's vocabulary.
"""
import json, os, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
CRAFT_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PUBLIC = os.path.join(CRAFT_ROOT, 'public')
VENDOR = os.path.join(PUBLIC, 'e2e-bake')  # gsap.min.js + ScrollTrigger.min.js live here

def die(m): sys.exit('bake: ' + m)
if len(sys.argv) < 3:
    die('usage: python3 bake.py <project.json> <out.html>')
src_path, out_path = sys.argv[1], sys.argv[2]
doc = json.load(open(src_path))

if isinstance(doc, list):
    layout = doc
    bands = [{'id': 'page', 'height': max((o.get('y', 0) + 200) for o in layout) if layout else 1280,
              'bg': '', 'color': '#0a0a0f'}]
else:
    layout = doc.get('layout') or doc.get('objects') or []
    bands = doc.get('bands') or doc.get('sections') or doc.get('pages') or []
if not bands:
    die('no bands found; pass a full project JSON')

W = doc.get('width', 390) if isinstance(doc, dict) else 390
TOTAL = sum(b['height'] for b in bands)

def abspath_src(src):
    if src.startswith('/templates/'):
        return 'file://' + os.path.join(PUBLIC, src.lstrip('/'))
    return src

def esc(s): return html.escape(s or '')
def blend(o): return (o.get('blend') or 'normal').replace('source-over', 'normal')

band_divs, y = [], 0
for b in bands:
    bg = abspath_src(b['bg']) if b.get('bg') else ''
    bgcss = f"background-image:url('{bg}');" if bg else ''
    band_divs.append(f"<div class='band' style=\"top:{y}px;height:{b['height']}px;"
                     f"background-color:{b.get('color', '#000')};{bgcss}\"></div>")
    y += b['height']

obj_divs = []
for o in layout:
    a = o.get('anim') or {}
    name = a.get('name', '') if isinstance(a, dict) else str(a or '')
    dur = a.get('dur', 1) if isinstance(a, dict) else 1
    common = f"data-anim='{name}' data-dur='{dur}'"
    if o['type'] == 'text':
        cs = o.get('charSpacing', 0) / 1000.0
        style = (f"left:{o['x']}px;top:{o['y']}px;width:{o.get('w',320)}px;font-size:{o['fontSize']}px;"
                 f"font-family:{o['fontFamily']};color:{o['fill']};text-align:{o.get('textAlign','left')};"
                 f"font-style:{o.get('fontStyle','normal')};font-weight:{o.get('fontWeight','400')};"
                 f"letter-spacing:{cs}em;line-height:{o.get('lineHeight',1.16)};opacity:{o.get('opacity',1)};"
                 f"mix-blend-mode:{blend(o)};")
        obj_divs.append(f"<div class='obj text' {common} style=\"{style}\">{esc(o['text'])}</div>")
    elif o['type'] == 'img':
        style = (f"left:{o['x']}px;top:{o['y']}px;width:{o['w']}px;height:{o['h']}px;"
                 f"opacity:{o.get('opacity',1)};mix-blend-mode:{blend(o)};")
        obj_divs.append(f"<img class='obj' {common} style=\"{style}\" src=\"{abspath_src(o['src'])}\">")

def vendor(fname):
    p = os.path.join(VENDOR, fname)
    return open(p).read() if os.path.exists(p) else ''
gsap_js = vendor('gsap.min.js')
st_js = vendor('ScrollTrigger.min.js')
if not gsap_js:
    print('WARN: gsap.min.js not found in public/e2e-bake — animations will be inert')

title = esc(doc.get('name', 'Invite')) if isinstance(doc, dict) else 'Invite'
html_out = f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<style>
  html,body{{margin:0;padding:0;background:{bands[0].get('color','#0a0a0f')};}}
  #scaler{{transform-origin:top left;}}
  #stage{{position:relative;width:{W}px;height:{TOTAL}px;overflow:hidden;}}
  .band{{position:absolute;left:0;width:{W}px;background-size:cover;background-position:center;}}
  .obj{{position:absolute;will-change:transform,opacity;}}
  .obj.text{{white-space:pre-wrap;}}
</style></head><body>
<div id="scaler"><div id="stage">
{chr(10).join(band_divs)}
{chr(10).join(obj_divs)}
</div></div>
<script>{gsap_js}</script>
<script>{st_js}</script>
<script>
gsap.registerPlugin(ScrollTrigger);
const DW={W}, TH={TOTAL};
function fit(){{const s=innerWidth/DW;scaler.style.transform=`scale(${{s}})`;document.body.style.height=(TH*s)+'px';}}
const scaler=document.getElementById('scaler');fit();addEventListener('resize',fit);
document.querySelectorAll('.obj').forEach(el=>{{
  const anim=el.dataset.anim,dur=parseFloat(el.dataset.dur||'1');if(!anim)return;
  const st={{trigger:el,start:'top 88%',toggleActions:'play none none none'}};
  if(anim==='reveal-up')gsap.from(el,{{y:26,autoAlpha:0,duration:dur,ease:'power2.out',scrollTrigger:st}});
  else if(anim==='reveal-soft')gsap.from(el,{{autoAlpha:0,scale:.985,duration:dur,ease:'power1.out',scrollTrigger:st}});
  else if(anim==='twinkle')gsap.to(el,{{opacity:.35,duration:dur/2,ease:'sine.inOut',repeat:-1,yoyo:true,delay:Math.random()}});
  else if(anim==='breathe')gsap.to(el,{{scale:1.04,duration:dur/2,ease:'sine.inOut',repeat:-1,yoyo:true}});
  else if(anim==='bob')gsap.to(el,{{y:'+=8',duration:dur/2,ease:'sine.inOut',repeat:-1,yoyo:true}});
  else if(anim==='float-drift')gsap.to(el,{{x:'+=10',y:'-=14',duration:dur,ease:'sine.inOut',repeat:-1,yoyo:true}});
}});
window.__baked=true;
</script></body></html>"""

open(out_path, 'w').write(html_out)
print(f'baked {out_path}  ({len(html_out)//1024}KB, {len(layout)} objects, {len(bands)} bands, {TOTAL}px tall)')
