// Run: node check.mjs — checks every link points at real events and runs forward in time.
import fs from 'fs';
globalThis.window = {}; new Function(fs.readFileSync(new URL('./data.js', import.meta.url), 'utf8'))();
const { EVENTS, LINKS, KINDS } = window, byId = new Map(); let bad = 0;
const fail = m => { bad++; console.log('✗', m); };
for (const e of EVENTS) { if (byId.has(e.id)) fail(`duplicate id ${e.id}`); byId.set(e.id, e);
  if (!KINDS[e.k]) fail(`${e.id}: unknown kind ${e.k}`);
  if (Math.abs(e.lat) > 90 || Math.abs(e.lon) > 180) fail(`${e.id}: bad coordinates`); }
const seen = new Set();
for (const l of LINKS) { const a = byId.get(l.from), b = byId.get(l.to);
  if (!a || !b) { fail(`link ${l.from} -> ${l.to}: unknown id`); continue; }
  if (a.y > b.y) fail(`link ${l.from} (${a.y}) -> ${l.to} (${b.y}) runs backwards in time`);
  const k = l.from + '>' + l.to; if (seen.has(k)) fail(`duplicate link ${k}`); seen.add(k); }
globalThis.window.STORIES = undefined; new Function(fs.readFileSync(new URL('./stories.js', import.meta.url), 'utf8'))();
for (const st of window.STORIES) for (let i = 0; st.ids && i < st.ids.length; i++) {
  if (!byId.has(st.ids[i])) fail(`story ${st.id}: unknown id ${st.ids[i]}`);
  else if (i && !LINKS.some(l => l.from === st.ids[i - 1] && l.to === st.ids[i])) fail(`story ${st.id}: no link ${st.ids[i - 1]} -> ${st.ids[i]}`); }
const linked = new Set(LINKS.flatMap(l => [l.from, l.to]));
console.log(`${EVENTS.length} events, ${LINKS.length} links, ${EVENTS.filter(e => !linked.has(e.id)).map(e => e.id).join(', ') || 'none'} unlinked`);
process.exit(bad ? 1 : 0);
