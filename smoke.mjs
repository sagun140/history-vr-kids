// Run: node smoke.mjs — serves the site on localhost, drives a real headless
// Chrome over the DevTools protocol, and fails if any page throws, renders
// empty, or loses a feature. Node 22+, no npm packages. Skips politely when no
// Chrome is installed so it never blocks a contributor.
//
// Offline VR check (A-Frame normally comes from a CDN):
//   AFRAME_LOCAL=/path/to/aframe-master.min.js node smoke.mjs
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CHROME = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && fs.existsSync(p));

let fails = 0, checks = 0;
const ok = (cond, what, detail) => { checks++; if (cond) console.log('  ✓', what); else { fails++; console.log('  ✗', what, detail === undefined ? '' : '→ ' + JSON.stringify(detail)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- a static server, so pages run over http like they will in the end ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const f = path.join(HERE, rel);
  if (!f.startsWith(HERE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// ---------- a small DevTools-protocol client ----------
let chrome, ws, nextId = 1, pageSession = null;
const waiting = new Map(), errors = [];
const send = (method, params = {}, sessionId = pageSession) => new Promise((resolve, reject) => {
  const id = nextId++;
  waiting.set(id, { resolve, reject });
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
});

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-smoke-'));
  chrome = spawn(CHROME, ['--headless=new', `--user-data-dir=${dir}`, '--remote-debugging-port=0',
    '--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--window-size=1280,900',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let buf = '';
  const port = await new Promise((resolve, reject) => {
    chrome.stderr.on('data', d => { buf += d; const m = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\//); if (m) resolve(m[1]); });
    chrome.on('exit', c => reject(new Error('chrome exited (' + c + '): ' + buf.slice(0, 300))));
    setTimeout(() => reject(new Error('chrome did not report a debugging port')), 20000);
  });
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result); return; }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
    if (m.method === 'Runtime.exceptionThrown') errors.push('uncaught: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null);
  pageSession = sessionId;
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  // Webfonts are decorative and a sandbox may stall them; block so runs are fast and identical everywhere.
  const blocked = ['*fonts.googleapis.com*', '*fonts.gstatic.com*'];
  if (process.env.AFRAME_LOCAL) blocked.push('*cdn.jsdelivr.net*');
  await send('Network.setBlockedURLs', { urls: blocked });
}

async function go(url) {
  errors.length = 0;
  await send('Page.navigate', { url });
  // about:blank is already "complete", so wait for the new URL to actually be the page.
  const want = url.replace(ORIGIN, '');
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    const href = await js('location.pathname + location.search').catch(() => null);
    if (href === want && await js('document.readyState').catch(() => null) === 'complete') break;
  }
  await sleep(200); // let the page's own start-up finish
}
async function js(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').split('\n')[0] + ' while evaluating ' + expression.slice(0, 90));
  return r.result.value;
}
// Blocked fonts/CDN in a sandbox are not page bugs.
const pageErrors = () => errors.filter(e => !/fonts\.(googleapis|gstatic)|jsdelivr|favicon|ERR_(BLOCKED|NAME_NOT_RESOLVED|CERT|PROXY|CONNECTION|INTERNET)/i.test(e));

// ---------- index.html ----------
async function testAtlas() {
  console.log('\natlas.html — the two-era map');
  await go(ORIGIN + '/atlas.html');
  ok(await js('window.EVENTS.length') === 189, 'all 189 events loaded');
  ok(await js('document.querySelectorAll(".ev").length') === 189, 'a dot on the map for every event');
  ok(await js('!!window.THREADS && typeof THREADS.findChains === "function"'), 'the shared thread logic is in place');
  ok(await js('document.querySelectorAll("#threads path.thread").length') > 0, 'threads drawn for the opening preset');
  ok((await js('document.getElementById("panel").textContent')).length > 120, 'the side panel explains the thread');
  ok(/then=105/.test(await js('location.search')), 'the address bar carries the view', await js('location.search'));
  ok(await js('!!document.getElementById("copyLink")'), 'there is a copy-link button');
  ok(await js('document.querySelectorAll(".sitenav a").length') === 4, 'nav links to the stories, atlas, AP kit and VR');

  await go(ORIGIN + '/atlas.html?event=gutenberg');
  const panel = await js('document.getElementById("panel").textContent');
  ok(/Printing press/.test(panel), 'deep link ?event=gutenberg opens that event', panel.slice(0, 60));
  ok(/trace back to this/.test(panel), 'it shows how much traces back to it');

  await go(ORIGIN + '/atlas.html?then=1815&now=1818');
  ok(/Tambora|Frankenstein/.test(await js('document.getElementById("panel").textContent')), 'deep link ?then=&now= sets both eras');
  ok(pageErrors().length === 0, 'no console errors', pageErrors());
}

// ---------- index.html (the picture slideshow) ----------
async function testStories() {
  console.log('\nindex.html — the picture stories');
  await go(ORIGIN + '/index.html');
  ok(await js('window.STORIES.length') >= 9, 'the stories are loaded', await js('window.STORIES.length'));
  ok(await js('document.querySelectorAll("#stories [data-story]").length') >= 9, 'every story has a button');
  ok((await js('document.getElementById("stage").textContent')).length > 40, 'the first slide renders');
  const first = await js('document.getElementById("count").textContent');
  await js(`document.getElementById("next").click()`);
  await sleep(400);
  ok(await js('document.getElementById("count").textContent') !== first, 'the arrow moves to the next picture', await js('document.getElementById("count").textContent'));
  ok(/atlas\.html/.test(await js('document.body.innerHTML')), 'it points at the two-era map');
  ok(/ap\.html/.test(await js('document.body.innerHTML')) && /vr\.html/.test(await js('document.body.innerHTML')), 'and at the AP kit and VR');
  ok(await js('!!document.querySelector(\'link[rel="canonical"]\')'), 'it can be indexed and shared');

  await go(ORIGIN + '/index.html#paper/3');
  ok(/paper\/3/.test(await js('location.hash')), 'a slide has its own address');
  ok(pageErrors().length === 0, 'no console errors', pageErrors());
}

// ---------- ap.html ----------
async function testAP() {
  console.log('\nap.html — the AP World History kit');
  await go(ORIGIN + '/ap.html');
  await js('localStorage.clear()');
  await go(ORIGIN + '/ap.html');
  ok(await js('window.AP.MCQ.reduce((n,s)=>n+s.qs.length,0)') === 55, '55 multiple-choice questions in the bank');
  ok(await js('window.AP.DBQ.docs.length') === 7, 'the DBQ has its seven documents');
  ok(/practice exam/i.test(await js('document.body.textContent')), 'the menu renders');

  await js('document.querySelector(\'[data-start="practice:full"]\').click()');
  await sleep(200);
  ok(await js('document.querySelectorAll(".choice").length') === 4, 'four choices on the first question');
  ok((await js('document.querySelector(".stim, table.stim").textContent')).length > 80, 'the stimulus is shown beside the question');
  await js('document.querySelectorAll(".choice")[0].click()');
  await sleep(200);
  ok(await js('document.querySelectorAll(".choice .why").length') === 4, 'practice mode explains all four options');
  ok(await js('!!document.querySelector(".choice.right")'), 'the right answer is marked');
  ok(await js('!!document.querySelector("a.atlas")'), 'the question links back to the atlas');
  ok(await js('document.querySelectorAll(".pad button").length') === 55, 'a jump pad for every question');

  // keyboard: B answers. Practice mode stays on the question so you can read why.
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'B', bubbles:true}))`);
  await sleep(200);
  ok(await js('document.querySelectorAll(".choice")[1].getAttribute("aria-pressed")') === 'true', 'a letter key answers the question');
  ok(await js('document.querySelector(".qtext") !== null'), 'and practice mode stays put to explain it');

  // a perfect paper
  ok(await js(`(() => {
    const S = JSON.parse(localStorage.getItem('butterfly.ap.v1'));
    const flat = []; AP.MCQ.forEach(s => s.qs.forEach(q => flat.push(q)));
    S.ans = {}; flat.forEach(q => S.ans[q.id] = q.answer);
    S.saqText = { seeded: 'x' }; S.saqSelf = {};
    AP.SAQ.filter(s => s.required || s.id === S.saqPick).forEach(s => s.parts.forEach(p => S.saqSelf[s.id + '.' + p.label] = 1));
    S.dbqText = 'x'; S.dbqSelf = {}; AP.DBQ.rubric.forEach((r, i) => S.dbqSelf[i] = r.pts);
    S.leqText = 'x'; S.leqPick = AP.LEQ[0].id; S.leqSelf = {}; AP.LEQ_RUBRIC.forEach((r, i) => S.leqSelf[i] = r.pts);
    S.view = 'report'; localStorage.setItem('butterfly.ap.v1', JSON.stringify(S));
    return flat.length; })()`) === 55, 'seeded a full, perfect run');
  await go(ORIGIN + '/ap.html');
  const report = await js('document.body.textContent');
  ok(/55\/55/.test(report), 'the report scores the multiple choice', report.match(/\d+\/55/));
  ok(/Predicted AP score/.test(report), 'a full run gets a predicted score');
  ok(await js('document.querySelector(".predict").textContent.trim()') === '5', 'a perfect paper predicts a 5');
  ok(await js('document.querySelectorAll(".barrow").length') >= 9, 'the report breaks results down by unit and skill');

  await js(`(() => { const S = JSON.parse(localStorage.getItem('butterfly.ap.v1'));
    const f = AP.MCQ[0].qs[0]; S.ans[f.id] = (f.answer + 1) % 4; S.view = 'report';
    localStorage.setItem('butterfly.ap.v1', JSON.stringify(S)); })()`);
  await go(ORIGIN + '/ap.html');
  const r2 = await js('document.body.textContent');
  ok(/What to look at again \(1\)/.test(r2), 'one missed question is listed for review');
  ok(/is right\./.test(r2), 'the review explains the right answer');
  ok(/54\/55/.test(r2), 'the score drops by exactly one');

  await js('localStorage.clear()');
  await go(ORIGIN + '/ap.html?exam');
  await sleep(1700);
  const clock = await js('document.getElementById("clock").textContent');
  ok(/^5[34]:\d\d$/.test(clock), 'exam mode counts down from 55 minutes', clock);
  ok(await js('document.querySelectorAll(".choice .why").length') === 0, 'exam mode hides the explanations');

  await go(ORIGIN + '/ap.html?writing');
  ok(/Document-based question/.test(await js('document.body.textContent')), 'writing-only entry works');
  await js('document.querySelector(\'[data-go="dbq"]\').click()');
  await sleep(200);
  ok(await js('document.querySelectorAll(".doc").length') === 7, 'all seven documents are laid out');
  await js(`(() => { const t = document.querySelector('[data-dbq]'); t.value = 'Thesis. '.repeat(40); t.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await sleep(150);
  ok(/\d+ words/.test(await js('document.querySelector(\'[data-count="dbq"]\').textContent')), 'the essay box counts words');
  await js('document.querySelector(\'[data-done="1"]\').click()');
  await sleep(250);
  ok(await js('document.querySelectorAll(".rubric .row").length') === 6, 'the seven-point rubric is offered for self-scoring');

  await js('localStorage.clear()');
  await go(ORIGIN + '/ap.html');
  await js('window.print = () => {}; document.querySelector(\'[data-print="key"]\').click()');
  await sleep(400);
  const sheet = await js('document.body.textContent');
  ok(/answer key/i.test(sheet) && /Document 7/.test(sheet), 'the answer-key sheet prints every section');
  ok(pageErrors().length === 0, 'no console errors', pageErrors());
}

// ---------- vr.html ----------
async function testVR() {
  console.log('\nvr.html — the headset version');
  let url = ORIGIN + '/vr.html';
  const local = process.env.AFRAME_LOCAL;
  if (local && fs.existsSync(local)) {
    fs.copyFileSync(local, path.join(HERE, '.aframe-local.js'));
    const tmp = path.join(HERE, '.vr-local.html');
    fs.writeFileSync(tmp, fs.readFileSync(path.join(HERE, 'vr.html'), 'utf8')
      .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/aframe@[^"]+/, '.aframe-local.js'));
    url = ORIGIN + '/.vr-local.html';
  }
  await go(url);
  const body = await js('document.body.textContent');
  ok(/Butterfly/.test(body), 'the landing page introduces it');
  ok(/Meta Quest/.test(body) && /Enter VR/.test(body), 'it says how to get in from a Quest');
  ok(/https/.test(body), 'it warns that WebXR needs https');
  ok(await js('!!document.querySelector("a-scene[webxr]")'), 'the scene asks for WebXR');
  ok(/hand-tracking/.test(await js('document.querySelector("a-scene").outerHTML.slice(0, 600)')), 'hand tracking is requested');
  ok(await js('document.querySelectorAll("[laser-controls]").length') === 2, 'both controllers are set up');

  if (!await js('!!window.AFRAME')) {
    console.log('  – A-Frame not reachable here, scene checks skipped (set AFRAME_LOCAL to run them offline)');
    return;
  }
  const c = 'document.querySelector("a-scene").components.atlas';
  for (let i = 0; i < 60; i++) { if (await js(`!!(${c} && ${c}.pins)`)) break; await sleep(250); }
  ok(await js(`${c}.pins.count`) === 189, 'one instanced dot per event, in a single draw call');
  ok(await js(`${c}.state.chains.length`) > 0, 'the opening preset finds a thread');
  ok(await js(`${c}.threadGroup.children.length`) > 0, 'the thread is built as 3D arcs over the map');
  ok(await js(`${c}.labelGroup.children.length`) > 0, 'events on the thread are labelled');
  ok(await js('document.querySelectorAll("#presets .ui").length') >= 7, 'preset and tool buttons exist', await js('document.querySelectorAll("#presets .ui").length'));
  ok(await js('document.querySelectorAll("#console .ui").length') === 1, 'the timeline is clickable');
  ok(await js(`${c}.pinPos.length`) === 189, 'every event has a place on the table');
  ok(await js(`Math.abs(${c}.pinPos[${await js('window.EVENTS.findIndex(e => e.id === "rome")')}].x) < 0.2`), 'Rome lands near the middle of the map');

  // a headset never composites the DOM, so instructions have to exist in the scene
  ok(await js(`!!${c}.hudMesh`), 'the HUD line exists inside the scene, not only in the page');
  ok(await js(`${c}.hudMesh.parent === document.getElementById("camera").object3D`), 'and it is in view wherever you look');
  await js(`${c}.sayHud("test line")`);
  ok(await js(`${c}.hudText`) === 'test line', 'saying something updates it');
  ok(await js(`${c}.hudMesh.material.opacity`) === 1, 'and brings it back to full strength');

  await js(`${c}.openEvent(window.EVENTS.findIndex(e => e.id === "gutenberg"))`);
  ok(await js(`${c}.state.focus`) === 'gutenberg', 'pointing at a dot opens that event');

  const before = await js(`${c}.lead().join(">")`);
  await js(`(() => { const a = ${c}; a.state.a = THREADS.toPos(1815); a.state.b = THREADS.toPos(1818); a.recompute(); })()`);
  const after = await js(`${c}.lead().join(">")`);
  ok(before !== after, 'moving the eras finds a different thread', after);
  ok(/frankenstein/.test(after), 'and the volcano preset leads to Frankenstein, as it promises', after);

  await js(`${c}.toggleWalk()`);
  ok(await js(`${c}.state.mode`) === 'walk', 'walk mode turns on');
  ok(await js(`${c}.corridor.children.length`) > 0, 'the corridor is built from the chain');
  ok(await js('document.getElementById("table").getAttribute("visible")') === false, 'the map steps aside while walking');
  await js(`${c}.walkStep(1)`);
  ok(await js('document.getElementById("rig").object3D.position.z') < 0, 'stepping forward snaps you down the corridor');
  await js(`${c}.toggleWalk()`);
  ok(await js('document.getElementById("rig").object3D.position.z') === 0, 'leaving walk mode puts you back at the table');
  ok(pageErrors().length === 0, 'no console errors', pageErrors());
}

// ---------- run ----------
if (!CHROME) { console.log('- no Chrome found, skipping browser tests (set CHROME_PATH)'); process.exit(0); }
try {
  await launch();
  await testStories();
  await testAtlas();
  await testAP();
  await testVR();
} catch (e) {
  if (/chrome exited|ENOENT|debugging port/.test(e.message)) { console.log('- could not start Chrome, skipping browser tests:', e.message.split('\n')[0]); process.exit(0); }
  fails++; console.log('✗ harness error:', e.message);
} finally {
  for (const f of ['.vr-local.html', '.aframe-local.js']) { const p = path.join(HERE, f); if (fs.existsSync(p)) fs.unlinkSync(p); }
  try { ws && ws.close(); } catch (e) { /* closing anyway */ }
  if (chrome) chrome.kill();
  server.close();
}
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
