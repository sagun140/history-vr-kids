// Run: node apcheck.mjs — checks the AP question bank is well formed and its
// atlas cross-links point at real events. Exits non-zero if anything is wrong.
import fs from 'fs';
const load = f => new Function(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))();
globalThis.window = {}; load('./data.js'); load('./apdata.js');
const { EVENTS, AP } = window, ids = new Set(EVENTS.map(e => e.id));
let bad = 0; const fail = m => { bad++; console.log('✗', m); };

const seen = new Set();
const uniq = (id, what) => { if (seen.has(id)) fail(`duplicate id ${id} (${what})`); seen.add(id); };
const atlas = (list, where) => (list || []).forEach(id => ids.has(id) || fail(`${where}: unknown atlas event "${id}"`));

// ----- Section I Part A -----
const answers = [0, 0, 0, 0];
let n = 0;
for (const s of AP.MCQ) {
  uniq(s.id, 'mcq set');
  if (!(s.unit >= 1 && s.unit <= 9)) fail(`${s.id}: unit ${s.unit} is not 1-9`);
  if (!s.stim || !s.stim.source) fail(`${s.id}: stimulus needs a source line`);
  if (s.stim && s.stim.kind === 'table' && !(s.stim.head && s.stim.rows)) fail(`${s.id}: table stimulus needs head and rows`);
  if (s.stim && s.stim.kind !== 'table' && !s.stim.body) fail(`${s.id}: stimulus needs a body`);
  for (const q of s.qs) {
    n++; uniq(q.id, 'question');
    if (q.choices.length !== 4) fail(`${q.id}: ${q.choices.length} choices, expected 4`);
    if (q.why.length !== 4) fail(`${q.id}: ${q.why.length} rationales, expected one per choice`);
    if (!(q.answer >= 0 && q.answer < 4)) fail(`${q.id}: answer index ${q.answer} out of range`);
    if (new Set(q.choices).size !== q.choices.length) fail(`${q.id}: duplicate choice text`);
    if (!AP.skills[q.skill]) fail(`${q.id}: unknown skill "${q.skill}"`);
    // Stems are either questions or sentence-completion stems; neither ends in a period.
    if (/\.$/.test(q.text.trim())) fail(`${q.id}: stem ends in a period — use a question or a completion stem`);
    if (q.text.trim().length < 25) fail(`${q.id}: stem looks too short to be a real stem`);
    answers[q.answer]++;
    atlas(q.atlas, q.id);
  }
}
const declared = AP.sections.find(s => s.id === 'mcq').count;
if (n !== declared) fail(`bank has ${n} multiple-choice questions but sections declares ${declared}`);
const skew = Math.max(...answers) - Math.min(...answers);
if (skew > Math.ceil(n / 4)) fail(`answer key is lopsided: A/B/C/D = ${answers.join('/')}`);

// ----- Section I Part B -----
for (const s of AP.SAQ) {
  uniq(s.id, 'saq');
  if (s.parts.length !== 3) fail(`${s.id}: ${s.parts.length} parts, expected 3`);
  if (s.guide.length !== s.parts.length) fail(`${s.id}: guide has ${s.guide.length} entries for ${s.parts.length} parts`);
  s.guide.forEach((g, i) => g.length || fail(`${s.id} part ${s.parts[i].label}: no acceptable answers listed`));
  atlas(s.atlas, s.id);
}
const required = AP.SAQ.filter(s => s.required).length, choice = AP.SAQ.filter(s => s.choiceGroup).length;
if (required !== 2) fail(`expected 2 required SAQs, found ${required}`);
if (choice !== 2) fail(`expected 2 choose-one SAQs, found ${choice}`);

// ----- Section II -----
const sum = r => r.reduce((t, x) => t + x.pts, 0);
uniq(AP.DBQ.id, 'dbq');
if (AP.DBQ.docs.length !== 7) fail(`DBQ has ${AP.DBQ.docs.length} documents, the exam uses 7`);
AP.DBQ.docs.forEach(d => { if (!d.source) fail(`DBQ doc ${d.n}: no source line`); if (!d.body && !d.rows) fail(`DBQ doc ${d.n}: no body`); });
if (sum(AP.DBQ.rubric) !== 7) fail(`DBQ rubric totals ${sum(AP.DBQ.rubric)} points, expected 7`);
if (sum(AP.LEQ_RUBRIC) !== 6) fail(`LEQ rubric totals ${sum(AP.LEQ_RUBRIC)} points, expected 6`);
AP.DBQ.rubric.concat(AP.LEQ_RUBRIC).forEach(r => r.check && r.check.length || fail(`rubric row "${r.name}": no self-check prompts`));
atlas(AP.DBQ.atlas, 'dbq');
for (const l of AP.LEQ) { uniq(l.id, 'leq'); if (!l.prompt.startsWith('Develop an argument')) fail(`${l.id}: LEQ prompts are worded "Develop an argument that..."`); atlas(l.atlas, l.id); }
if (AP.LEQ.length !== 3) fail(`expected 3 LEQ options, found ${AP.LEQ.length}`);

// ----- Weighting -----
const w = AP.sections.reduce((t, s) => t + s.weight, 0);
if (Math.abs(w - 1) > 1e-9) fail(`section weights sum to ${w}, expected 1`);
const mins = AP.sections.reduce((t, s) => t + s.minutes, 0);
const units = new Set(AP.MCQ.map(s => s.unit));
for (let u = 1; u <= 9; u++) if (!units.has(u)) fail(`no multiple-choice set covers unit ${u}`);

console.log(`${AP.MCQ.length} stimulus sets, ${n} multiple-choice questions (key A/B/C/D = ${answers.join('/')}), ${AP.SAQ.length} short-answer, ${AP.DBQ.docs.length}-document DBQ, ${AP.LEQ.length} long-essay options`);
console.log(`all 9 units covered, ${mins} minutes of exam, ${AP.MCQ.reduce((t, s) => t + s.qs.reduce((u, q) => u + q.atlas.length, 0), 0)} atlas cross-links`);
process.exit(bad ? 1 : 0);
