import fs from 'node:fs';
import path from 'node:path';

/*
  Gatsby Nights generator — copied from heritage/scripts/gen_celestial.mjs + gen_t2i.mjs.
  usage:
    KIE_API_KEY=.. IMGBB_API_KEY=.. node e2e/gen_gatsby.mjs anchor
    KIE_API_KEY=.. IMGBB_API_KEY=.. node e2e/gen_gatsby.mjs bands  [onlyPrefix]
    KIE_API_KEY=.. IMGBB_API_KEY=.. node e2e/gen_gatsby.mjs sheets [onlyPrefix]
  - anchor = t2i, 9:16 1K → assets/gatsby/c-marquee.png (band 1, LOCKED style ref)
  - bands  = 3 continuity-chained i2i bands (anchor for STYLE + previous band for EDGE)
  - sheets = 4 parallel 2x2 asset sheets on pure black → assets/gatsby/raw/
*/

const KIE = process.env.KIE_API_KEY || process.env.KIE_KEY;
const IMGBB = process.env.IMGBB_API_KEY || process.env.IMGBB_KEY;
const MODE = process.argv[2], ONLY = process.argv[3] || '', RES = '1K';
if (!KIE || !IMGBB) { console.error('Missing KIE_API_KEY / IMGBB_API_KEY'); process.exit(1); }

const BASE = path.join(path.dirname(new URL(import.meta.url).pathname), 'assets', 'gatsby');
const RAW = path.join(BASE, 'raw');
fs.mkdirSync(RAW, { recursive: true });
const ANCHOR_PATH = path.join(BASE, 'c-marquee.png');

const STYLE = `Use the attached reference image(s) ONLY as a strict STYLE, PALETTE and TEXTURE guide — match the 1920s ART DECO GATSBY aesthetic: luminous champagne-gold geometric linework and gilded surfaces glowing against deep noir night (#0a0a0f) with subtle deep-emerald shadow tones, fine metallic grain, symmetrical stepped forms, sunburst fans, elegant vintage-poster finish, couture and RESTRAINED (never garish or busy). Do NOT copy any layout; create exactly the new element described below.`;

const BAND = `FULL-BLEED VERTICAL PORTRAIT (9:16), edge to edge, no frame, no border. NO people, NO text, NO letters, NO numbers, NO logos, NO watermark. This is ONE band of a tall CONTINUOUS downward-scrolling evening at a 1920s gala — the areas at the very TOP and very BOTTOM MUST be smooth open near-black night (matching deep noir #0a0a0f, a few faint gold dust specks at most) so this band blends seamlessly into the ones above and below it.`;

const CHAIN = `\n\nCONTINUITY: the SECOND reference image is the band that sits directly ABOVE this one in the scroll. The TOP ~20% of THIS new band must continue seamlessly from the BOTTOM of that reference — same near-black night tone, same faint gold-dust density feathering downward into this frame, as if it is one single tall poster travelled through. Keep the join invisible.`;

const ANCHOR_PROMPT = `A breathtaking 1920s ART DECO wedding-invitation background, vertical portrait. The grand facade of a gilded Art Deco theatre at night seen from the plaza: a magnificent symmetric sunburst marquee canopy of luminous champagne-gold geometric rays fanning upward, stepped gilded pilasters, warm golden light spilling from beneath the canopy, thin elegant gold linework details. Deep noir night sky (#0a0a0f) with faint gold dust. Palette strictly: champagne gold #e9c97c, brass #b9862f, ivory #f3ecd8 on near-black, with subtle deep-emerald shadow tones. Luxurious vintage gold-foil poster finish, fine metallic grain, symmetrical, couture and RESTRAINED. The very TOP and very BOTTOM of the image must be smooth open near-black night for seamless blending. NO people, NO text, NO letters, NO numbers, NO logos, NO watermark, no frame, no border.`;

const BANDS = [
  { out: 'c-ballroom.png', p: `${BAND}\n\nBAND = THE BALLROOM. Moving inside the gala: a grand Art Deco ballroom interior — tall symmetric stepped gold arches receding, a glowing geometric chandelier near the top, soft champagne bokeh and warm gilded haze. THE CENTRE MUST STAY CALM, DARK AND OPEN (an uncluttered noir zone where the couple's names will be placed later). Faint deep-emerald tones in the shadows. Open near-black at top and bottom for blending.` },
  { out: 'c-skyline.png', p: `${BAND}\n\nBAND = THE CITY NIGHT. A 1920s Art Deco skyline in gold silhouette along the lower third — stepped towers, spires, tiny lit windows — with two or three slender searchlight beams sweeping up into the deep noir sky. The UPPER TWO THIRDS mostly calm open night with faint gold dust (space for event cards). Open near-black at top and bottom for blending.` },
  { out: 'c-finale.png', p: `${BAND}\n\nBAND = THE FINALE. High above the rooftops: two or three delicate gold FIREWORK bursts and drifting champagne-gold confetti sparkling in the deep noir sky, celebratory but elegant and sparse. KEEP THE CENTRE CALM AND OPEN for an RSVP panel. At the very BOTTOM edge a faint warm gold glow from the city below. Open near-black at the top for blending.` },
];

const SHEET = (tl, tr, bl, br) => `${STYLE}

Render an asset sheet: EXACTLY FOUR separate subjects arranged in a STRICT 2×2 GRID (two columns, two rows). Each subject is an elegant luminous ART DECO GOLD illustration — fine glowing champagne-gold linework with soft gilded fill and a little gold dust, like gold-foil 1920s wedding stationery. Each subject sits fully inside its own quadrant, centred, with clear margin; subjects must NOT touch or overlap each other or the image edges. The ENTIRE background is PURE SOLID BLACK (#000000) everywhere — no scene, no ground, no frames around quadrants, no grid lines, no dividers, NO text, NO watermark.

TOP-LEFT: ${tl}
TOP-RIGHT: ${tr}
BOTTOM-LEFT: ${bl}
BOTTOM-RIGHT: ${br}`;

const SHEETS = [
  { out: 'sheet-ornaments.png', p: SHEET(
    'a symmetric Art Deco SUNBURST FAN ornament, rays stepping outward from a half-circle base',
    'a long slender horizontal Art Deco DIVIDER — a centre diamond with stepped lines extending left and right',
    'an Art Deco CORNER FLOURISH — geometric stepped fronds and one thin curl, designed to sit in a corner',
    'an ornate Art Deco MEDALLION FRAME — an octagonal/circular gilded frame with stepped border, EMPTY dark centre'
  )},
  { out: 'sheet-objects.png', p: SHEET(
    'two vintage champagne COUPE glasses gently clinking, art-deco engraved, tiny gold bubbles rising',
    'a geometric Art Deco CHANDELIER with tiered stepped gold rings and hanging crystal drops',
    'a vintage GRAMOPHONE with a fluted gilded horn, side view',
    'a round vintage CLOCK FACE at nearly midnight, deco numerals as simple line marks (no readable digits), gilded stepped bezel'
  )},
  { out: 'sheet-ambient.png', p: SHEET(
    'a loose cluster of drifting gold CONFETTI — small circles, rectangles and thin ribbons scattering',
    'a single elegant FIREWORK burst — thin gold rays with tiny spark tips, delicate and sparse',
    'a small cluster of Art Deco eight-pointed STARS of varied sizes with a little gold dust',
    'a single elegant gilded ostrich FEATHER, softly curved'
  )},
  { out: 'sheet-arch.png', p: SHEET(
    'a grand Art Deco ARCHWAY / proscenium — stepped concentric gold arches, open dark centre',
    'a long horizontal 1920s Art Deco SKYLINE silhouette strip — stepped towers and spires in glowing gold outline',
    'a tall rectangular Art Deco ORNATE FRAME with stepped corners and inner keyline, EMPTY dark centre',
    'a stylised Art Deco FAN PALM LEAF — pleated geometric fronds spreading from a slim stem'
  )},
];

const jget = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { _raw: t }; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fx(url, opts, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, opts); if (r.status >= 500) throw new Error('http ' + r.status); return r; }
    catch (e) { last = e; await sleep(1500 * (i + 1) + Math.floor((i + 1) * 700)); }
  }
  throw last;
}
async function uploadImgbb(buf) {
  const f = new URLSearchParams(); f.set('key', IMGBB); f.set('image', buf.toString('base64'));
  const up = await jget(await fx('https://api.imgbb.com/1/upload', { method: 'POST', body: f }));
  if (!up?.data?.url) throw new Error('imgbb failed: ' + JSON.stringify(up).slice(0, 200));
  return up.data.url;
}
async function genOne(model, prompt, inputUrls, aspect) {
  const input = { prompt, aspect_ratio: aspect, resolution: RES };
  if (inputUrls) input.input_urls = inputUrls;
  const c = await jget(await fx('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST', headers: { Authorization: `Bearer ${KIE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  }));
  if (c.code !== 200) throw new Error(`createTask ${c.code} ${c.msg || ''}`);
  const id = c.data.taskId;
  console.log('   taskId:', id);
  for (let i = 0; i < 75; i++) {
    await sleep(8000);
    const d = (await jget(await fx(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${id}`, { headers: { Authorization: `Bearer ${KIE}` } }))).data;
    if (d?.state === 'success') return Buffer.from(await (await fx(JSON.parse(d.resultJson).resultUrls[0], {})).arrayBuffer());
    if (d?.state === 'fail') throw new Error(`FAIL ${d.failCode} ${d.failMsg}`);
  }
  throw new Error('timeout');
}

if (MODE === 'anchor') {
  console.log('t2i anchor (c-marquee, 9:16)...');
  const img = await genOne('gpt-image-2-text-to-image', ANCHOR_PROMPT, null, '9:16');
  fs.writeFileSync(ANCHOR_PATH, img);
  console.log('SAVED', ANCHOR_PATH, (img.length / 1024 | 0) + 'KB');
} else if (MODE === 'bands') {
  console.log('uploading anchor to imgbb...');
  const anchorUrl = await uploadImgbb(fs.readFileSync(ANCHOR_PATH));
  console.log('anchor:', anchorUrl, '\n');
  const sel = ONLY ? BANDS.filter(b => b.out.startsWith(ONLY)) : BANDS;
  let prevUrl = anchorUrl;                                   // band above = the anchor (band 1)
  const failed = [];
  for (const job of sel) {                                   // SEQUENTIAL for the continuity chain
    const refs = prevUrl === anchorUrl ? [anchorUrl] : [anchorUrl, prevUrl];
    const prompt = `${STYLE}\n\n${job.p}${prevUrl === anchorUrl ? '' : CHAIN}`;
    try {
      const img = await genOne('gpt-image-2-image-to-image', prompt, refs, '9:16');
      fs.writeFileSync(path.join(BASE, job.out), img);
      console.log(`✓ ${job.out}  (${(img.length / 1024 | 0)}KB)`);
      prevUrl = await uploadImgbb(img);                      // continuity ref for the next band
    } catch (e) { console.log(`✗ ${job.out}  ${e.message}`); failed.push(job.out); prevUrl = anchorUrl; }
  }
  console.log('\nbands done.', failed.length ? 'FAILED: ' + failed.join(', ') : 'all ok');
} else if (MODE === 'sheets') {
  console.log('uploading anchor to imgbb...');
  const anchorUrl = await uploadImgbb(fs.readFileSync(ANCHOR_PATH));
  console.log('anchor:', anchorUrl, '\n');
  const sel = ONLY ? SHEETS.filter(b => b.out.startsWith(ONLY)) : SHEETS;
  const run = async (job) => {
    try {
      const img = await genOne('gpt-image-2-image-to-image', job.p, [anchorUrl], '1:1');
      fs.writeFileSync(path.join(RAW, job.out), img);
      console.log(`✓ ${job.out}  (${(img.length / 1024 | 0)}KB)`); return null;
    } catch (e) { console.log(`✗ ${job.out}  ${e.message}`); return job.out; }
  };
  const failed = (await Promise.all(sel.map(run))).filter(Boolean);
  console.log('\nsheets done.', failed.length ? 'FAILED: ' + failed.join(', ') : 'all ok');
} else { console.error('usage: node gen_gatsby.mjs <anchor|bands|sheets> [onlyPrefix]'); process.exit(1); }
