import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
  Craft asset generator — KIE (gpt-image-2) anchor + i2i bands + i2i asset sheets.
  Config-driven port of the proven heritage/gatsby generators. One theme = one theme.json.

  usage:
    node gen.mjs all    <theme.json>          # anchor -> bands -> sheets, in order
    node gen.mjs anchor <theme.json>
    node gen.mjs bands  <theme.json> [prefix]
    node gen.mjs sheets <theme.json> [prefix]
    add --dry to any of the above to validate config + prompts + paths WITHOUT calling KIE.

  Keys: read from env (KIE_API_KEY / IMGBB_API_KEY) else from ../keys/keys.env.
  Output: <craftRoot>/public/templates/assets/<theme>/  (so the tool serves them directly)
          bands + anchor -> that folder; raw sheets -> that folder/raw/.
*/

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CRAFT_ROOT = path.resolve(HERE, '..', '..');       // craft/

// ---- args ----
const DRY = process.argv.includes('--dry');
const args = process.argv.slice(2).filter(a => a !== '--dry');
const MODE = args[0];
const CONFIG_PATH = args[1];
const PREFIX = args[2] || '';
if (!MODE || !CONFIG_PATH) {
  console.error('usage: node gen.mjs <all|anchor|bands|sheets> <theme.json> [prefix] [--dry]');
  process.exit(1);
}

// ---- keys ----
function loadKeys() {
  let kie = process.env.KIE_API_KEY, imgbb = process.env.IMGBB_API_KEY;
  const envFile = path.resolve(HERE, '..', 'keys', 'keys.env');
  if ((!kie || !imgbb) && fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/.exec(line);
      if (!m) continue;
      if (m[1] === 'KIE_API_KEY' && !kie) kie = m[2];
      if (m[1] === 'IMGBB_API_KEY' && !imgbb) imgbb = m[2];
    }
  }
  return { kie, imgbb };
}
const { kie: KIE, imgbb: IMGBB } = loadKeys();
if (!DRY && (!KIE || !IMGBB)) { console.error('Missing KIE_API_KEY / IMGBB_API_KEY (env or pipeline/keys/keys.env)'); process.exit(1); }

// ---- config ----
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const THEME = cfg.theme || 'theme';
const RES = cfg.resolution || '1K';
const OUT = cfg.outBase ? path.resolve(cfg.outBase) : path.join(CRAFT_ROOT, 'public', 'templates', 'assets', THEME);
const RAW = path.join(OUT, 'raw');
if (!DRY) fs.mkdirSync(RAW, { recursive: true });   // dry-run must not touch disk
const ANCHOR_PATH = path.join(OUT, cfg.anchor?.out || 'anchor.png');

function bandPrompt(job, isChained) {
  return `${cfg.style}\n\n${cfg.bandCommon || ''}\n\n${job.prompt}${isChained && cfg.chainNote ? '\n\n' + cfg.chainNote : ''}`;
}
function sheetPrompt(job) {
  if (job.prompt) return `${cfg.style}\n\n${job.prompt}`;
  return `${cfg.style}\n\n${cfg.sheetCommon}\n\nTOP-LEFT: ${job.tl}\nTOP-RIGHT: ${job.tr}\nBOTTOM-LEFT: ${job.bl}\nBOTTOM-RIGHT: ${job.br}`;
}

// ---- KIE plumbing (verbatim from the proven gatsby generator) ----
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

async function ensureAnchorUrl() {
  if (!fs.existsSync(ANCHOR_PATH)) throw new Error(`anchor not found at ${ANCHOR_PATH} — run "anchor" first`);
  console.log('uploading anchor to imgbb...');
  const url = await uploadImgbb(fs.readFileSync(ANCHOR_PATH));
  console.log('anchor:', url, '\n');
  return url;
}

// ---- stages ----
async function doAnchor() {
  const a = cfg.anchor || {};
  console.log(`ANCHOR (${a.mode || 't2i'}) -> ${path.relative(CRAFT_ROOT, ANCHOR_PATH)}`);
  if (DRY) { console.log('  [dry] prompt:', (a.prompt || '').slice(0, 120) + '...'); return; }
  let refs = null;
  if (a.mode === 'i2i') {
    const rp = (a.refs || []).map(r => path.isAbsolute(r) ? r : path.resolve(path.dirname(CONFIG_PATH), r));
    if (!rp.length) throw new Error('anchor mode i2i but no refs given');
    refs = [];
    for (const p of rp) { console.log('  upload ref:', p); refs.push(await uploadImgbb(fs.readFileSync(p))); }
  }
  const model = a.mode === 'i2i' ? 'gpt-image-2-image-to-image' : 'gpt-image-2-text-to-image';
  const img = await genOne(model, a.prompt, refs, a.aspect || '9:16');
  fs.writeFileSync(ANCHOR_PATH, img);
  console.log('  SAVED', path.relative(CRAFT_ROOT, ANCHOR_PATH), (img.length / 1024 | 0) + 'KB');
}

async function doBands() {
  const sel = (cfg.bands || []).filter(b => !PREFIX || b.out.startsWith(PREFIX));
  console.log(`BANDS (${sel.length}, chain=${!!cfg.chain}) 9:16`);
  if (DRY) { sel.forEach(b => console.log('  [dry]', b.out, '::', b.prompt.slice(0, 80) + '...')); return; }
  const anchorUrl = await ensureAnchorUrl();
  let prevUrl = anchorUrl;
  const failed = [];
  for (const job of sel) {
    const chained = cfg.chain && prevUrl !== anchorUrl;
    const refs = chained ? [anchorUrl, prevUrl] : [anchorUrl];
    try {
      const img = await genOne('gpt-image-2-image-to-image', bandPrompt(job, chained), refs, '9:16');
      fs.writeFileSync(path.join(OUT, job.out), img);
      console.log(`  ✓ ${job.out} (${(img.length / 1024 | 0)}KB)`);
      if (cfg.chain) prevUrl = await uploadImgbb(img);
    } catch (e) { console.log(`  ✗ ${job.out}  ${e.message}`); failed.push(job.out); prevUrl = anchorUrl; }
  }
  console.log('bands done.', failed.length ? 'FAILED: ' + failed.join(', ') : 'all ok');
}

async function doSheets() {
  const sel = (cfg.sheets || []).filter(s => !PREFIX || s.out.startsWith(PREFIX));
  console.log(`SHEETS (${sel.length}) 1:1 pure-black 2x2`);
  if (DRY) { sel.forEach(s => console.log('  [dry]', s.out, '::', (s.names || []).join(', '))); return; }
  const anchorUrl = await ensureAnchorUrl();
  const run = async (job) => {
    try {
      const img = await genOne('gpt-image-2-image-to-image', sheetPrompt(job), [anchorUrl], '1:1');
      fs.writeFileSync(path.join(RAW, job.out), img);
      console.log(`  ✓ ${job.out} (${(img.length / 1024 | 0)}KB)`); return null;
    } catch (e) { console.log(`  ✗ ${job.out}  ${e.message}`); return job.out; }
  };
  const failed = (await Promise.all(sel.map(run))).filter(Boolean);
  console.log('sheets done.', failed.length ? 'FAILED: ' + failed.join(', ') : 'all ok');
}

// ---- run ----
if (DRY) console.log(`[DRY RUN] theme="${THEME}" out=${path.relative(CRAFT_ROOT, OUT)}\n`);
if (MODE === 'all') { await doAnchor(); await doBands(); await doSheets(); }
else if (MODE === 'anchor') await doAnchor();
else if (MODE === 'bands') await doBands();
else if (MODE === 'sheets') await doSheets();
else { console.error('unknown mode:', MODE); process.exit(1); }
console.log(DRY ? '\n[dry] config + prompts + paths OK.' : '\ndone.');
