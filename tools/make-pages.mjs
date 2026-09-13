// Run: node tools/make-pages.mjs — writes one small, readable page per event into
// e/, an index of them, and sitemap.xml. These are the pages a search engine can
// actually read: the interactive atlas is one URL, but "why did the Black Death
// spread so fast" is a question someone types. Each page is real content — what
// happened, what caused it, what it led to — and a door into the atlas.
//
// The site does not need these files to work. CI regenerates them before every
// deploy, so they can never go stale; run it locally to preview.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.env.BASE_URL || 'https://sagun140.github.io/history-vr-kids/';
const load = f => new Function(fs.readFileSync(path.join(ROOT, f), 'utf8'))();
globalThis.window = {};
load('data.js'); load('threads.js'); load('apdata.js');
const { EVENTS, KINDS, THREADS: T, AP } = window;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const out = path.join(ROOT, 'e');
fs.mkdirSync(out, { recursive: true });

// Which AP units lean on this event, so a page can offer the matching practice.
const apUnits = new Map();
for (const set of AP.MCQ) for (const q of set.qs) for (const id of q.atlas) {
  if (!apUnits.has(id)) apUnits.set(id, new Set());
  apUnits.get(id).add(set.unit);
}

const head = (title, desc, canon, extra = '') => `<!doctype html>
<html lang="en">
<title>${esc(title)}</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta name="theme-color" content="#17243a">
<link rel="icon" href="../icon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Butterfly Atlas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${BASE}og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../theme.css">
<style>
  .wrap { max-width: 720px; margin: 0 auto; display: grid; gap: 16px; }
  h1 { font-family: var(--display); font-weight: 400; font-size: clamp(28px, 6vw, 42px); line-height: 1.08; margin: 0; text-wrap: balance; }
  .meta { font-family: var(--mono); color: var(--muted); font-size: 14px; }
  .card { background: var(--panel); border-radius: 18px; padding: 16px 18px; }
  .card h2 { font-size: 15px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  .lede { font-size: 19px; margin: 0; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 6px 0; }
  li b { font-weight: 800; }
  li span { color: var(--muted); display: block; font-size: 14px; }
  a { color: var(--thread); }
  .stat { font-family: var(--display); font-size: 32px; color: var(--thread); line-height: 1; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  footer { color: var(--muted); font-size: 13px; }
</style>
${extra}
<body>
<div class="wrap">`;

const foot = `</div></body></html>`;

const nav = `<nav class="row sitenav" aria-label="Site">
  <a class="chip" href="../index.html">The atlas</a>
  <a class="chip" href="../ap.html">AP practice kit</a>
  <a class="chip" href="../vr.html">VR for Quest</a>
  <a class="chip" href="./">All events</a>
</nav>`;

let n = 0;
for (const e of EVENTS) {
  const canon = `${BASE}e/${e.id}.html`;
  const causes = T.inn.get(e.id), leads = T.out.get(e.id), ds = T.descendants(e.id).size;
  const desc = e.s.length > 155 ? e.s.slice(0, 152) + '…' : e.s;
  const title = `${e.t} (${T.when(e)}) — Butterfly Atlas`;
  const units = [...(apUnits.get(e.id) || [])].sort();
  const item = (l, other) => {
    const o = T.byId.get(other);
    return `<li><a href="${o.id}.html"><b>${esc(o.t)}</b></a> · ${esc(T.when(o))}<span>${esc(l.why)}</span></li>`;
  };
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: `${e.t} (${T.when(e)})`, description: e.s, url: canon,
    about: { '@type': 'Thing', name: e.t },
    isPartOf: { '@type': 'WebSite', name: 'Butterfly Atlas', url: BASE },
    contentLocation: { '@type': 'Place', name: e.p, geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lon } },
    isAccessibleForFree: true, inLanguage: 'en',
  };
  const html = head(title, desc, canon, `<script type="application/ld+json">${JSON.stringify(jsonld, null, 1)}</script>`) + `
${nav}
<header>
  <p class="meta">${esc(KINDS[e.k])} · ${esc(T.when(e))} · ${esc(e.p)}</p>
  <h1>${esc(e.t)}</h1>
</header>
<p class="lede">${esc(e.s)}</p>

<section class="card">
  <h2>What led to this</h2>
  ${causes.length ? `<ul>${causes.map(l => item(l, l.from)).join('')}</ul>`
    : `<p>Nothing in the atlas yet. What do you think led to it?</p>`}
</section>

<section class="card">
  <h2>What it led to</h2>
  ${leads.length ? `<ul>${leads.map(l => item(l, l.to)).join('')}</ul>`
    : `<p>Nothing in the atlas yet. What might it have changed?</p>`}
</section>

${ds ? `<section class="card">
  <h2>The butterfly effect</h2>
  <p><span class="stat">${ds}</span> later events in this atlas trace back to ${esc(e.t)}, however long the chain.</p>
  <p><a href="../index.html?event=${e.id}">Watch it ripple outward on the map →</a></p>
</section>` : ''}

<section class="card">
  <h2>Follow it yourself</h2>
  <div class="row">
    <a class="chip" href="../index.html?event=${e.id}">See it on the map</a>
    <a class="chip" href="../vr.html">Walk a thread in VR</a>
    ${units.map(u => `<a class="chip" href="../ap.html?unit=${u}">AP practice · Unit ${u}</a>`).join('')}
  </div>
</section>

<footer>
  <p>From the <a href="../index.html">Butterfly Atlas</a>, a free world history atlas for kids and teachers. Nothing in history happens alone.</p>
</footer>
` + foot;
  fs.writeFileSync(path.join(out, e.id + '.html'), html);
  n++;
}

// an index of everything, oldest first — a page a crawler can walk
const byEra = [...EVENTS].sort((a, b) => a.y - b.y);
fs.writeFileSync(path.join(out, 'index.html'), head(
  'Every event in the Butterfly Atlas',
  `All ${EVENTS.length} events in the Butterfly Atlas, from the first farms to the present, each with what caused it and what it led to.`,
  `${BASE}e/`) + `
${nav}
<header><h1>Every event in the atlas</h1>
<p class="meta">${EVENTS.length} events, ${window.LINKS.length} links between them, oldest first.</p></header>
<section class="card"><ul>
${byEra.map(e => `<li><a href="${e.id}.html"><b>${esc(e.t)}</b></a> · ${esc(T.when(e))} · ${esc(e.p)}<span>${esc(e.s)}</span></li>`).join('\n')}
</ul></section>
<footer><p><a href="../index.html">Back to the map →</a></p></footer>
` + foot);

// sitemap
const stamp = fs.statSync(path.join(ROOT, 'data.js')).mtime.toISOString().slice(0, 10);
const urls = [
  { loc: BASE, pri: '1.0' }, { loc: BASE + 'ap.html', pri: '0.9' }, { loc: BASE + 'vr.html', pri: '0.9' },
  { loc: BASE + 'e/', pri: '0.7' },
  ...EVENTS.map(e => ({ loc: `${BASE}e/${e.id}.html`, pri: '0.6' })),
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${stamp}</lastmod><priority>${u.pri}</priority></url>`).join('\n') +
  `\n</urlset>\n`);

console.log(`${n} event pages + an index in e/, ${urls.length} urls in sitemap.xml (base ${BASE})`);
