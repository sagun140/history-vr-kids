// AP World History: Modern practice kit — exam engine.
// Section I Part A (55 MCQ / 55 min), Part B (3 SAQ / 40 min),
// Section II Part A (DBQ / 60 min), Part B (LEQ / 40 min).
// Exam mode hides feedback until the end; practice mode explains every choice as you go.
(() => {
  const AP = window.AP, EV = new Map(window.EVENTS.map(e => [e.id, e]));
  const app = document.getElementById("app");
  const SEC = Object.fromEntries(AP.sections.map(s => [s.id, s]));
  const MAX = { mcq: 55, saq: 9, dbq: 7, leq: 6 };

  // Every multiple-choice question in order, plus a lookup by id.
  const FLAT = [];
  AP.MCQ.forEach(s => s.qs.forEach(q => FLAT.push({ set: s, q })));
  const byQid = new Map(FLAT.map(f => [f.q.id, f]));

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
  const words = t => (t.trim().match(/\S+/g) || []).length;
  const LTR = ["A", "B", "C", "D"];
  const KEY = "butterfly.ap.v1";

  const fresh = () => ({
    view: "home", mode: "exam", scope: "full", unit: null,
    order: [], i: 0, ans: {}, flags: [],
    saqPick: "saq3", saqText: {}, saqSelf: {},
    leqPick: null, leqText: "", leqSelf: {},
    dbqText: "", dbqSelf: {},
    left: {}, stage: {}, seen: [],
  });
  let S = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* private mode, no saving */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  // ----- scoring -----
  const mcqAsked = () => S.order.length || 55;
  const mcqScore = () => S.order.reduce((n, id) => n + (S.ans[id] === byQid.get(id).q.answer ? 1 : 0), 0);
  const selfSum = o => Object.values(o || {}).reduce((n, v) => n + (+v || 0), 0);
  const sectionPct = () => ({
    mcq: mcqScore() / mcqAsked(), saq: selfSum(S.saqSelf) / MAX.saq,
    dbq: selfSum(S.dbqSelf) / MAX.dbq, leq: selfSum(S.leqSelf) / MAX.leq,
  });
  const attempted = id => id === "mcq" ? S.order.some(q => S.ans[q] != null)
    : id === "saq" ? Object.keys(S.saqText).length > 0
    : id === "dbq" ? S.dbqText.trim().length > 0 : S.leqText.trim().length > 0;
  const composite = () => {
    const p = sectionPct();
    let got = 0, of = 0;
    for (const s of AP.sections) { if (!attempted(s.id)) continue; got += p[s.id] * s.weight; of += s.weight; }
    return of ? { pct: got / of, full: of > 0.999 } : { pct: 0, full: false };
  };
  const predict = pct => AP.curve.find(c => pct >= c.min).score;

  // ----- timer -----
  let tick = null;
  const secsFor = id => SEC[id].minutes * 60;
  const timed = () => S.mode === "exam" && ["mcq", "saq", "dbq", "leq"].includes(S.view) && S.stage[S.view] !== "score";
  function startClock() {
    clearInterval(tick);
    if (!timed()) return;
    if (S.left[S.view] == null) S.left[S.view] = secsFor(S.view);
    tick = setInterval(() => {
      S.left[S.view]--; save();
      const el = document.getElementById("clock");
      if (el) { el.textContent = mmss(S.left[S.view]); el.classList.toggle("low", S.left[S.view] < 300); }
      if (S.left[S.view] <= 0) { clearInterval(tick); endSection(true); }
    }, 1000);
  }
  function endSection(outOfTime) {
    clearInterval(tick);
    const v = S.view;
    if (v === "mcq") { go("saq"); }
    else { S.stage[v] = "score"; go(v); }
    if (outOfTime) flash("Time is up for that section. " + (v === "mcq" ? "Moving on." : "Score what you wrote."));
  }
  let flashMsg = "";
  const flash = m => { flashMsg = m; render(); };

  // ----- navigation -----
  function go(view) { S.view = view; S.i = 0; save(); render(); window.scrollTo({ top: 0 }); }
  function startRun(mode, scope, unit) {
    Object.assign(S, { mode, scope, unit, ans: {}, flags: [], left: {}, stage: {}, saqText: {}, saqSelf: {}, dbqText: "", dbqSelf: {}, leqText: "", leqSelf: {}, leqPick: null, i: 0 });
    S.order = scope === "unit" ? FLAT.filter(f => f.set.unit === unit).map(f => f.q.id)
      : scope === "quick" ? FLAT.filter((_, i) => i % 5 === 0).slice(0, 10).map(f => f.q.id)
      : FLAT.map(f => f.q.id);
    go("mcq");
  }

  // ----- home -----
  function renderHome() {
    const qs = FLAT.length, saved = S.order.length && S.order.some(id => S.ans[id] != null) && !attempted("leq");
    app.innerHTML = `
      <section class="card">
        <p class="eyebrow">${esc(AP.course)} · practice kit</p>
        <h2 class="big">A full practice exam, scored the way the real one is.</h2>
        <p class="note">${qs} stimulus-based multiple-choice questions across all nine units, ${AP.SAQ.length} short-answer questions, a ${AP.DBQ.docs.length}-document DBQ and ${AP.LEQ.length} long-essay options — with rubrics, rationales for every choice, and a link from each question back to the event on the atlas map.</p>
        <p class="note" style="margin-top:8px"><b>${esc(AP.unofficial)}</b></p>
      </section>

      ${saved ? `<div class="menu"><button class="tile resume" data-go="resume"><b>Resume where you left off</b><span class="mono">${esc(SEC[S.view] ? SEC[S.view].name : "in progress")} · ${S.mode} mode</span></button></div>` : ""}

      <div class="menu">
        <button class="tile" data-start="exam:full"><b>Full practice exam</b><span class="mono">3 h 15 min · timed · no feedback until the end</span><span class="note">All four sections, back to back, with the real per-section clocks.</span></button>
        <button class="tile" data-start="practice:full"><b>Practice all 55 questions</b><span class="mono">untimed · explains every choice</span><span class="note">Each answer is marked right or wrong straight away, with a reason for all four options.</span></button>
        <button class="tile" data-start="practice:quick"><b>Quick 10</b><span class="mono">untimed · 10 questions across the units</span><span class="note">A short warm-up that touches every period.</span></button>
        <button class="tile" data-go="writing"><b>Writing only</b><span class="mono">SAQ · DBQ · LEQ with rubrics</span><span class="note">Skip the multiple choice and work on the parts that carry 60% of the score.</span></button>
      </div>

      <section class="card" style="margin-top:12px">
        <p class="eyebrow">Practice one unit</p>
        <div class="units">${AP.units.map(u => `<button class="chip" data-unit="${u.n}">Unit ${u.n} · ${esc(u.title)}</button>`).join("")}</div>
        <p class="note" style="margin-top:8px">${AP.units.map(u => `${u.n}: ${esc(u.span)}`).join(" · ")}</p>
      </section>

      <section class="card" style="margin-top:12px">
        <p class="eyebrow">For teachers</p>
        <div class="units">
          <button class="chip" data-go="report">Score report</button>
          <button class="chip" data-print="blank">Print the exam</button>
          <button class="chip" data-print="key">Print with answer key</button>
          <a class="chip" href="index.html">Open the atlas</a>
          <a class="chip" href="vr.html">Open in VR</a>
        </div>
        <p class="note" style="margin-top:8px">Nothing is uploaded anywhere. Your answers stay in this browser, and clearing site data clears them.</p>
      </section>`;
  }

  // ----- shared chrome -----
  const bar = (title, right) => `
    <div class="bar">
      <span class="sec">${esc(title)}</span>
      <button class="btn" data-go="home">Menu</button>
      ${right || ""}
      <span class="clock ${timed() ? "" : "off"}" id="clock">${timed() ? mmss(S.left[S.view] == null ? secsFor(S.view) : S.left[S.view]) : "untimed"}</span>
    </div>
    ${flashMsg ? `<div class="card" style="margin-bottom:12px"><b>${esc(flashMsg)}</b></div>` : ""}`;

  const stimHTML = st => !st ? "" : st.kind === "table"
    ? `<p class="src">${esc(st.source)}</p><table class="stim"><thead><tr>${st.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${st.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : `<p class="src">${esc(st.source)}</p><div class="stim quote">${esc(st.body)}</div>`;

  const atlasLinks = ids => !ids || !ids.length ? "" :
    `<p style="margin-top:8px">${ids.filter(id => EV.has(id)).map(id => `<a class="atlas" href="index.html?event=${encodeURIComponent(id)}" target="_blank" rel="noopener">${esc(EV.get(id).t)} on the map</a>`).join(" · ")}</p>`;

  // ----- Section I Part A -----
  function renderMCQ() {
    if (!S.order.length) S.order = FLAT.map(f => f.q.id);
    const id = S.order[S.i], f = byQid.get(id), q = f.q;
    const picked = S.ans[id], show = S.mode === "practice" && picked != null;
    const sameSet = S.order.filter(x => byQid.get(x).set.id === f.set.id);
    app.innerHTML = bar(`${SEC.mcq.name} · question ${S.i + 1} of ${S.order.length}`,
      `<button class="btn" data-flag="1" aria-pressed="${S.flags.includes(id)}">Flag</button>
       <span class="mono note">Unit ${f.set.unit}</span>`) + `
      <div class="grid">
        <section class="card">
          <p class="eyebrow">${sameSet.length > 1 ? `Questions for this source (${sameSet.length})` : "Source"}</p>
          ${stimHTML(f.set.stim)}
        </section>
        <section class="card">
          <p class="skill">${esc(AP.skills[q.skill])}</p>
          <p class="qtext">${esc(q.text)}</p>
          <div class="choices">
            ${q.choices.map((c, n) => {
              const cls = show ? (n === q.answer ? "right" : n === picked ? "wrong" : "") : "";
              return `<button class="choice ${cls}" data-pick="${n}" aria-pressed="${picked === n}">
                <span class="ltr">${LTR[n]}</span><span>${esc(c)}</span>
                ${show ? `<span class="why">${esc(q.why[n])}</span>` : ""}</button>`;
            }).join("")}
          </div>
          ${show ? atlasLinks(q.atlas) : ""}
          <div class="nav">
            <button class="btn" data-nav="-1" ${S.i === 0 ? "disabled" : ""}>← Back</button>
            <button class="btn" data-nav="1" ${S.i === S.order.length - 1 ? "disabled" : ""}>Next →</button>
            <span class="spacer"></span>
            <span class="mono note">${Object.keys(S.ans).length} answered</span>
            <button class="btn" data-done="1">${S.mode === "exam" ? "End section" : "See results"}</button>
          </div>
          <div class="pad">${S.order.map((x, n) => `<button data-jump="${n}" aria-current="${n === S.i}" class="${S.ans[x] != null ? "done" : ""} ${S.flags.includes(x) ? "flag" : ""}">${n + 1}</button>`).join("")}</div>
          <p class="note" style="margin-top:8px">Keys: <b class="mono">A–D</b> or <b class="mono">1–4</b> to answer, <b class="mono">←/→</b> to move, <b class="mono">F</b> to flag.</p>
        </section>
      </div>`;
  }

  // ----- Section I Part B -----
  function renderSAQ() {
    const list = AP.SAQ.filter(s => s.required || s.id === S.saqPick);
    const scoring = S.stage.saq === "score";
    app.innerHTML = bar(`${SEC.saq.name} · short answer`,
      `<span class="mono note">Answer 1 and 2, then your choice of 3 or 4</span>`) + `
      <section class="card" style="margin-bottom:12px">
        <p class="eyebrow">Choose your third question</p>
        <div class="units">${AP.SAQ.filter(s => s.choiceGroup).map(s => `<button class="chip" data-saqpick="${s.id}" aria-pressed="${S.saqPick === s.id}">Question ${s.id.slice(-1)} · ${esc(s.window)}</button>`).join("")}</div>
      </section>
      ${list.map((s, n) => `
        <section class="card" style="margin-bottom:12px">
          <p class="eyebrow">Question ${n + 1}${s.kind ? " · " + esc(s.kind) : ""}${s.window ? " · " + esc(s.window) : ""}</p>
          ${s.stim ? stimHTML(s.stim) : ""}
          ${s.parts.map((p, pi) => `
            <div class="part">
              <b>(${p.label}) ${esc(p.prompt)}</b>
              <textarea data-saq="${s.id}.${p.label}" placeholder="Two or three sentences is plenty. Answer the verb: identify, describe, explain.">${esc((S.saqText[s.id + "." + p.label]) || "")}</textarea>
              <span class="count" data-count="${s.id}.${p.label}">${words(S.saqText[s.id + "." + p.label] || "")} words</span>
              ${scoring ? `
                <div class="guide">
                  <b>Answers that would earn the point</b>
                  <ul>${s.guide[pi].map(g => `<li>${esc(g)}</li>`).join("")}</ul>
                  <div class="pick">Give yourself:
                    <button class="btn" data-self="saq:${s.id}.${p.label}:0" aria-pressed="${(S.saqSelf[s.id + "." + p.label] || 0) == 0}">0</button>
                    <button class="btn" data-self="saq:${s.id}.${p.label}:1" aria-pressed="${S.saqSelf[s.id + "." + p.label] == 1}">1 point</button>
                  </div>
                </div>` : ""}
            </div>`).join("")}
          ${scoring ? atlasLinks(s.atlas) : ""}
        </section>`).join("")}
      <div class="nav">
        ${scoring
          ? `<span class="mono">Short answer: ${selfSum(S.saqSelf)} / ${MAX.saq}</span><span class="spacer"></span><button class="btn" data-go="dbq">On to the DBQ →</button>`
          : `<button class="btn" data-done="1">Done writing — show the rubric</button><span class="spacer"></span><button class="btn" data-go="dbq">Skip to the DBQ →</button>`}
      </div>`;
  }

  // ----- Section II Part A -----
  function renderDBQ() {
    const d = AP.DBQ, scoring = S.stage.dbq === "score", left = S.left.dbq == null ? secsFor("dbq") : S.left.dbq;
    app.innerHTML = bar(`${SEC.dbq.name} · document-based question`,
      `<span class="mono note">${S.mode === "exam" && left > (SEC.dbq.minutes - SEC.dbq.reading) * 60 ? "suggested reading period" : "writing time"}</span>`) + `
      <section class="card" style="margin-bottom:12px">
        <p class="eyebrow">Prompt · ${esc(d.window)}</p>
        <h2 class="big">${esc(d.prompt)}</h2>
        <p class="note">${esc(d.note)} Seven documents, 60 minutes, and the first 15 are meant for reading and planning.</p>
      </section>
      <div class="grid">
        <section class="card">
          <p class="eyebrow">The documents</p>
          <div class="docs">${d.docs.map(doc => `
            <article class="doc">
              <span class="n">Document ${doc.n}</span>
              <p class="src">${esc(doc.source)}</p>
              ${doc.kind === "table"
                ? `<table class="stim"><thead><tr>${doc.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${doc.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
                : `<div class="stim">${esc(doc.body)}</div>`}
            </article>`).join("")}</div>
        </section>
        <section class="card">
          <p class="eyebrow">Your essay</p>
          <textarea style="min-height:46vh" data-dbq="1" placeholder="Thesis first. Then use at least six documents, say why each source's position matters for three of them, bring in one thing from outside the documents, and complicate your own argument before the end.">${esc(S.dbqText)}</textarea>
          <span class="count" data-count="dbq">${words(S.dbqText)} words</span>
          ${scoring ? rubricHTML(d.rubric, "dbq", S.dbqSelf) + atlasLinks(d.atlas) + `
            <p class="eyebrow" style="margin-top:12px">Evidence beyond the documents you could have used</p>
            <ul class="note" style="margin:4px 0 0;padding-left:18px">${d.outside.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
          <div class="nav">
            ${scoring
              ? `<span class="mono">DBQ: ${selfSum(S.dbqSelf)} / ${MAX.dbq}</span><span class="spacer"></span><button class="btn" data-go="leq">On to the long essay →</button>`
              : `<button class="btn" data-done="1">Done writing — show the rubric</button><span class="spacer"></span><button class="btn" data-go="leq">Skip to the essay →</button>`}
          </div>
        </section>
      </div>`;
  }

  // ----- Section II Part B -----
  function renderLEQ() {
    const scoring = S.stage.leq === "score", chosen = AP.LEQ.find(l => l.id === S.leqPick);
    app.innerHTML = bar(`${SEC.leq.name} · long essay`, `<span class="mono note">Choose one of ${AP.LEQ.length}</span>`) + `
      <section class="card" style="margin-bottom:12px">
        <p class="eyebrow">Pick one prompt</p>
        ${AP.LEQ.map(l => `
          <div class="part">
            <button class="choice" data-leqpick="${l.id}" aria-pressed="${S.leqPick === l.id}">
              <span class="ltr">${l.option}</span>
              <span><b>${esc(l.window)}</b><br>${esc(l.prompt)}</span>
            </button>
          </div>`).join("")}
      </section>
      ${chosen ? `
        <section class="card">
          <p class="eyebrow">Your essay · ${esc(chosen.window)}</p>
          <p class="note">${esc(chosen.prompt)}</p>
          <textarea style="min-height:40vh;margin-top:8px" data-leq="1" placeholder="Thesis, context, at least two specific examples used as evidence, and a complication you raise yourself.">${esc(S.leqText)}</textarea>
          <span class="count" data-count="leq">${words(S.leqText)} words</span>
          ${scoring ? rubricHTML(AP.LEQ_RUBRIC, "leq", S.leqSelf) + `
            <p class="eyebrow" style="margin-top:12px">Evidence that would work for this prompt</p>
            <ul class="note" style="margin:4px 0 0;padding-left:18px">${chosen.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
            ${atlasLinks(chosen.atlas)}` : ""}
          <div class="nav">
            ${scoring
              ? `<span class="mono">Long essay: ${selfSum(S.leqSelf)} / ${MAX.leq}</span><span class="spacer"></span><button class="btn" data-go="report">See my score →</button>`
              : `<button class="btn" data-done="1">Done writing — show the rubric</button><span class="spacer"></span><button class="btn" data-go="report">Skip to the score →</button>`}
          </div>
        </section>` : `<p class="note">Choose a prompt to start writing.</p>`}`;
  }

  const rubricHTML = (rows, key, store) => `
    <p class="eyebrow" style="margin-top:14px">Score yourself against the rubric</p>
    <div class="rubric">${rows.map((r, n) => `
      <div class="row">
        <b>${esc(r.name)} · ${r.pts} point${r.pts > 1 ? "s" : ""}</b>
        <div class="ask">${esc(r.ask)}</div>
        <ul class="check">${r.check.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
        <div class="pick">${Array.from({ length: r.pts + 1 }, (_, v) =>
          `<button class="btn" data-self="${key}:${n}:${v}" aria-pressed="${(store[n] || 0) == v}">${v}</button>`).join("")}</div>
      </div>`).join("")}</div>`;

  // ----- report -----
  function renderReport() {
    const p = sectionPct(), c = composite(), mc = mcqScore();
    const byUnit = new Map(), bySkill = new Map();
    for (const id of S.order) {
      if (S.ans[id] == null) continue;
      const f = byQid.get(id), ok = S.ans[id] === f.q.answer;
      for (const [map, k] of [[byUnit, f.set.unit], [bySkill, f.q.skill]]) {
        const r = map.get(k) || { ok: 0, n: 0 }; r.ok += ok ? 1 : 0; r.n++; map.set(k, r);
      }
    }
    const meter = (label, r) => `<div class="barrow"><span>${esc(label)}</span><span class="meter"><i style="width:${Math.round(r.ok / r.n * 100)}%"></i></span><span class="mono">${r.ok}/${r.n}</span></div>`;
    const missed = S.order.filter(id => S.ans[id] != null && S.ans[id] !== byQid.get(id).q.answer);
    app.innerHTML = bar("Score report") + `
      <section class="card">
        <p class="eyebrow">${c.full ? "Predicted AP score" : "Sections attempted so far"}</p>
        ${c.full
          ? `<div class="predict">${predict(c.pct)}</div><p class="note">From ${Math.round(c.pct * 100)}% of the weighted total. The real curve is set each year and is not published in advance, so treat this as a rough band, not a promise.</p>`
          : `<h2 class="big">${Math.round(c.pct * 100)}% of what you attempted</h2><p class="note">Finish all four sections in one run to get a predicted 1–5.</p>`}
        <div class="scores" style="margin-top:12px">
          ${AP.sections.map(s => `<div class="score"><p class="eyebrow">${esc(s.label)}</p>
            <div class="v">${attempted(s.id) ? (s.id === "mcq" ? `${mc}/${mcqAsked()}` : `${selfSum(s.id === "saq" ? S.saqSelf : s.id === "dbq" ? S.dbqSelf : S.leqSelf)}/${MAX[s.id]}`) : "—"}</div>
            <span class="mono note">${Math.round(s.weight * 100)}% of the exam</span></div>`).join("")}
        </div>
      </section>

      ${byUnit.size ? `<section class="card" style="margin-top:12px">
        <p class="eyebrow">Multiple choice by unit</p>
        <div class="bars">${[...byUnit.keys()].sort((a, b) => a - b).map(u => meter(`Unit ${u} · ${AP.units[u - 1].title}`, byUnit.get(u))).join("")}</div>
        <p class="eyebrow" style="margin-top:14px">By historical thinking skill</p>
        <div class="bars">${[...bySkill.keys()].map(k => meter(AP.skills[k], bySkill.get(k))).join("")}</div>
      </section>` : ""}

      ${missed.length ? `<section class="card" style="margin-top:12px">
        <p class="eyebrow">What to look at again (${missed.length})</p>
        ${missed.map(id => { const f = byQid.get(id), q = f.q, mine = S.ans[id]; return `
          <div class="miss">
            <span class="tag">Unit ${f.set.unit} · ${esc(AP.skills[q.skill])}</span>
            <p class="q">${esc(q.text)}</p>
            <p><b style="color:var(--bad)">You chose ${LTR[mine]}.</b> ${esc(q.why[mine])}</p>
            <p><b style="color:var(--good)">${LTR[q.answer]} is right.</b> ${esc(q.why[q.answer])}</p>
            ${atlasLinks(q.atlas)}
          </div>`; }).join("")}
      </section>` : ""}

      <div class="nav">
        <button class="btn" data-go="home">Menu</button>
        <button class="btn" data-print="report">Print this report</button>
        <button class="btn" data-reset="1">Clear and start over</button>
      </div>`;
  }

  // ----- writing-only entry -----
  function renderWriting() {
    app.innerHTML = bar("Writing practice") + `
      <div class="menu">
        <button class="tile" data-go="saq"><b>Short answer</b><span class="mono">${SEC.saq.minutes} min · ${MAX.saq} points</span><span class="note">Two required questions plus your choice, with the answers that earn each point.</span></button>
        <button class="tile" data-go="dbq"><b>Document-based question</b><span class="mono">${SEC.dbq.minutes} min · ${MAX.dbq} points</span><span class="note">Seven documents and the full seven-point rubric.</span></button>
        <button class="tile" data-go="leq"><b>Long essay</b><span class="mono">${SEC.leq.minutes} min · ${MAX.leq} points</span><span class="note">Choose one of three prompts across the periods.</span></button>
      </div>`;
  }

  // ----- print sheets -----
  function printSheet(kind) {
    if (kind === "report") { window.print(); return; }
    const key = kind === "key";
    const d = AP.DBQ;
    app.innerHTML = `<section class="card sheet" style="display:block">
      <h2 class="big">${esc(AP.course)} — practice exam${key ? " (answer key)" : ""}</h2>
      <p class="note">${esc(AP.unofficial)}</p>
      <h3>${esc(SEC.mcq.name)} — ${SEC.mcq.count} questions, ${SEC.mcq.minutes} minutes</h3>
      ${AP.MCQ.map(s => `<div class="doc" style="margin:10px 0">
        ${stimHTML(s.stim)}
        ${s.qs.map(q => `<div class="part"><b>${esc(q.text)}</b>
          <ol type="A" style="margin:4px 0 0">${q.choices.map((c, n) => `<li${key && n === q.answer ? ' style="font-weight:800"' : ""}>${esc(c)}${key ? ` <i class="note">${esc(q.why[n])}</i>` : ""}</li>`).join("")}</ol></div>`).join("")}
      </div>`).join("")}
      <h3>${esc(SEC.saq.name)} — answer 1 and 2, then 3 or 4, ${SEC.saq.minutes} minutes</h3>
      ${AP.SAQ.map((s, n) => `<div class="doc" style="margin:10px 0"><b>Question ${n + 1}${s.window ? " · " + esc(s.window) : ""}</b>
        ${s.stim ? stimHTML(s.stim) : ""}
        ${s.parts.map((p, pi) => `<p>(${p.label}) ${esc(p.prompt)}${key ? `<br><i class="note">${esc(s.guide[pi].join(" / "))}</i>` : ""}</p>`).join("")}</div>`).join("")}
      <h3>${esc(SEC.dbq.name)} — ${SEC.dbq.minutes} minutes</h3>
      <p><b>${esc(d.prompt)}</b></p>
      ${d.docs.map(doc => `<div class="doc" style="margin:8px 0"><b>Document ${doc.n}</b><p class="src">${esc(doc.source)}</p>${doc.kind === "table" ? `<table class="stim">${doc.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>` : `<div class="stim">${esc(doc.body)}</div>`}</div>`).join("")}
      ${key ? `<p><b>Rubric</b></p><ul>${d.rubric.map(r => `<li>${esc(r.name)} (${r.pts}): ${esc(r.ask)}</li>`).join("")}</ul>` : ""}
      <h3>${esc(SEC.leq.name)} — choose one, ${SEC.leq.minutes} minutes</h3>
      ${AP.LEQ.map(l => `<p><b>Option ${l.option} · ${esc(l.window)}</b><br>${esc(l.prompt)}</p>`).join("")}
      ${key ? `<ul>${AP.LEQ_RUBRIC.map(r => `<li>${esc(r.name)} (${r.pts}): ${esc(r.ask)}</li>`).join("")}</ul>` : ""}
      <p class="noprint"><button class="btn" data-go="home">Back to the menu</button></p>
    </section>`;
    window.print();
  }

  // ----- render + events -----
  function render() {
    const v = S.view;
    if (v === "mcq") renderMCQ();
    else if (v === "saq") renderSAQ();
    else if (v === "dbq") renderDBQ();
    else if (v === "leq") renderLEQ();
    else if (v === "report") renderReport();
    else if (v === "writing") renderWriting();
    else renderHome();
    flashMsg = "";
    startClock();
    save();
  }

  app.addEventListener("click", e => {
    const t = e.target.closest("[data-go],[data-start],[data-unit],[data-pick],[data-nav],[data-jump],[data-flag],[data-done],[data-self],[data-saqpick],[data-leqpick],[data-print],[data-reset]");
    if (!t) return;
    const d = t.dataset;
    if (d.go) { if (d.go === "resume") render(); else go(d.go); return; }
    if (d.start) { const [mode, scope] = d.start.split(":"); startRun(mode, scope); return; }
    if (d.unit) { startRun("practice", "unit", +d.unit); return; }
    if (d.print) { printSheet(d.print); return; }
    if (d.reset) { if (confirm("Clear your answers and start over?")) { S = fresh(); save(); render(); } return; }
    if (d.pick != null) { S.ans[S.order[S.i]] = +d.pick; if (S.mode === "exam" && S.i < S.order.length - 1) S.i++; render(); return; }
    if (d.nav) { S.i = Math.min(S.order.length - 1, Math.max(0, S.i + +d.nav)); render(); return; }
    if (d.jump) { S.i = +d.jump; render(); return; }
    if (d.flag) { const id = S.order[S.i]; S.flags = S.flags.includes(id) ? S.flags.filter(x => x !== id) : S.flags.concat(id); render(); return; }
    if (d.done) { endSection(false); return; }
    if (d.saqpick) { S.saqPick = d.saqpick; render(); return; }
    if (d.leqpick) { S.leqPick = d.leqpick; render(); return; }
    if (d.self) {
      const [which, k, v] = d.self.split(":");
      (which === "saq" ? S.saqSelf : which === "dbq" ? S.dbqSelf : S.leqSelf)[k] = +v;
      render();
    }
  });

  app.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.saq) S.saqText[t.dataset.saq] = t.value;
    else if (t.dataset.dbq) S.dbqText = t.value;
    else if (t.dataset.leq) S.leqText = t.value;
    else return;
    const key = t.dataset.saq || (t.dataset.dbq ? "dbq" : "leq");
    const c = app.querySelector(`[data-count="${key}"]`);
    if (c) c.textContent = words(t.value) + " words";
    save();
  });

  document.addEventListener("keydown", e => {
    if (S.view !== "mcq" || (e.target.matches && e.target.matches("textarea, input"))) return;
    const k = e.key.toUpperCase();
    if (LTR.includes(k) || "1234".includes(k)) {
      const n = LTR.includes(k) ? LTR.indexOf(k) : +k - 1;
      S.ans[S.order[S.i]] = n; if (S.mode === "exam" && S.i < S.order.length - 1) S.i++;
      e.preventDefault(); render();
    } else if (e.key === "ArrowRight") { S.i = Math.min(S.order.length - 1, S.i + 1); render(); }
    else if (e.key === "ArrowLeft") { S.i = Math.max(0, S.i - 1); render(); }
    else if (k === "F") { const id = S.order[S.i]; S.flags = S.flags.includes(id) ? S.flags.filter(x => x !== id) : S.flags.concat(id); render(); }
  });

  // Deep links: ap.html?unit=4, ?practice, ?exam, ?writing
  const p = new URLSearchParams(location.search);
  if (p.has("unit")) startRun("practice", "unit", +p.get("unit"));
  else if (p.has("exam")) startRun("exam", "full");
  else if (p.has("practice")) startRun("practice", "full");
  else if (p.has("writing")) go("writing");
  else render();
})();
