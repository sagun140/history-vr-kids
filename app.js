(() => {
  const { EVENTS, LINKS, MAP } = window;
  const $ = id => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";
  const byId = new Map(EVENTS.map(e => [e.id, e]));
  const out = new Map(EVENTS.map(e => [e.id, []]));
  const inn = new Map(EVENTS.map(e => [e.id, []]));
  for (const l of LINKS) { out.get(l.from).push(l); inn.get(l.to).push(l); }
  const whyOf = (a, b) => out.get(a).find(l => l.to === b).why;

  // ----- Time scale: squeezes the deep past so recent centuries get room -----
  const ANCHORS = [[-10000, 0], [-3000, .12], [-500, .25], [500, .37], [1000, .45], [1500, .58], [1750, .7], [1900, .83], [2025, 1]];
  const toPos = y => { for (let i = 1; i < ANCHORS.length; i++) { const [y0, p0] = ANCHORS[i - 1], [y1, p1] = ANCHORS[i]; if (y <= y1) return p0 + (p1 - p0) * (Math.max(y, y0) - y0) / (y1 - y0); } return 1; };
  const toYear = p => { for (let i = 1; i < ANCHORS.length; i++) { const [y0, p0] = ANCHORS[i - 1], [y1, p1] = ANCHORS[i]; if (p <= p1) return Math.round(y0 + (y1 - y0) * (Math.max(p, p0) - p0) / (p1 - p0)); } return 2025; };
  const fmtYear = y => y < 0 ? `${(-y).toLocaleString()} BCE` : y < 1000 ? `${y} CE` : `${y}`;
  const when = e => e.when || (e.ca ? "c. " : "") + fmtYear(e.y);

  // ----- Map projection (Natural Earth, matches land.js) -----
  function project(lon, lat) {
    const l = lon * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2;
    const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [MAP.tx + MAP.k * x, MAP.ty - MAP.k * y];
  }
  $("sphere").setAttribute("d", MAP.sphere);
  $("grat").setAttribute("d", MAP.grat);
  $("land").setAttribute("d", MAP.land);
  const XY = new Map(EVENTS.map(e => [e.id, project(e.lon, e.lat)]));

  const state = { a: toPos(105), b: toPos(1969), w: 0.05, chains: [], pick: 0, focus: null, classMode: false, step: 0, hide: false, revealed: new Set() };

  // ----- Eras -----
  const range = p => [toYear(Math.max(0, p - state.w / 2)), toYear(Math.min(1, p + state.w / 2))];
  function eras() {
    let A = range(state.a), B = range(state.b);
    return A[0] <= B[0] ? [A, B] : [B, A];
  }

  // ----- Find threads from the earlier era to the later one -----
  function findChains() {
    const [A, B] = eras();
    const inA = e => e.y >= A[0] && e.y <= A[1], inB = e => e.y >= B[0] && e.y <= B[1];
    const found = [];
    const walk = (path) => {
      if (found.length > 4000) return;
      const last = byId.get(path[path.length - 1]);
      if (path.length > 1 && inB(last)) { found.push(path.slice()); return; }
      if (path.length > 9) return;
      for (const l of out.get(last.id)) {
        const nx = byId.get(l.to);
        if (nx.y > B[1] || path.includes(nx.id)) continue;
        path.push(nx.id); walk(path); path.pop();
      }
    };
    EVENTS.filter(inA).forEach(e => walk([e.id]));
    found.sort((p, q) => p.length - q.length || (byId.get(q[q.length - 1]).y - byId.get(q[0]).y) - (byId.get(p[p.length - 1]).y - byId.get(p[0]).y));
    const chosen = [];
    for (const p of found) {
      const overlap = c => p.filter(id => c.includes(id)).length / p.length;
      if (chosen.some(c => (c[0] === p[0] && c.at(-1) === p.at(-1)) || overlap(c) > .5)) continue;
      chosen.push(p);
      if (chosen.length === 5) break;
    }
    return chosen;
  }

  // ----- Drawing helpers -----
  const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(svgNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent && parent.appendChild(n); return n; };
  const mix = (t) => `color-mix(in oklch, var(--then) ${Math.round((1 - t) * 100)}%, var(--now))`;
  function arc(a, b) {
    const [x1, y1] = XY.get(a), [x2, y2] = XY.get(b);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, d = Math.hypot(x2 - x1, y2 - y1);
    return `M${x1},${y1} Q${mx},${my - Math.max(18, d * .28)} ${x2},${y2}`;
  }
  function drawThread(a, b, cls, delay) {
    const p = el("path", { d: arc(a, b), class: "thread " + cls }, $("threads"));
    if (cls.includes("draw")) { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.style.animationDelay = delay + "s"; }
    return p;
  }

  // ----- Dots for every event -----
  for (const e of EVENTS) {
    const [x, y] = XY.get(e.id);
    const c = el("circle", { cx: x, cy: y, r: 4.2, class: "ev", tabindex: 0, "data-id": e.id }, $("dots"));
    c.addEventListener("click", () => openEvent(e.id));
    c.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openEvent(e.id); } });
  }
  const tip = $("tip");
  $("map").addEventListener("pointerover", ev => {
    const id = ev.target.closest("[data-id]")?.dataset.id; if (!id) return;
    const e = byId.get(id), box = $("mapwrap").getBoundingClientRect(), r = ev.target.getBoundingClientRect();
    tip.innerHTML = `<small>${when(e)} · ${e.p}</small>${e.t}`;
    tip.style.left = (r.left + r.width / 2 - box.left) + "px"; tip.style.top = (r.top - box.top) + "px"; tip.hidden = false;
  });
  $("map").addEventListener("pointerout", () => tip.hidden = true);

  // ----- Timeline -----
  for (const e of EVENTS) { const t = document.createElement("i"); t.className = "tick"; t.style.left = (toPos(e.y) * 100) + "%"; t.title = `${when(e)}: ${e.t}`; $("ticks").appendChild(t); }
  $("axis").innerHTML = ANCHORS.filter((_, i) => i !== 3 && i !== 5).map(([y, p]) => `<span style="left:${p * 100}%">${fmtYear(y)}</span>`).join("");

  function placeBands() {
    for (const k of ["a", "b"]) {
      const band = $(k === "a" ? "bandA" : "bandB"), p = state[k], lo = Math.max(0, p - state.w / 2), hi = Math.min(1, p + state.w / 2);
      band.style.left = lo * 100 + "%"; band.style.width = (hi - lo) * 100 + "%";
      const [y0, y1] = range(p);
      band.setAttribute("aria-valuetext", `${fmtYear(y0)} to ${fmtYear(y1)}`);
      $(k === "a" ? "eraA" : "eraB").innerHTML = `<b>${k === "a" ? "Then" : "Now"}</b>${fmtYear(y0)} – ${fmtYear(y1)}`;
    }
  }
  let dragging = null;
  const posFromEvent = ev => { const r = $("track").getBoundingClientRect(); return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); };
  $("track").addEventListener("pointerdown", ev => {
    const p = posFromEvent(ev);
    dragging = ev.target.closest(".band")?.classList.contains("b") ? "b" : ev.target.closest(".band") ? "a" : (Math.abs(p - state.a) < Math.abs(p - state.b) ? "a" : "b");
    $("track").setPointerCapture(ev.pointerId); state[dragging] = p; clearPreset(); update();
  });
  $("track").addEventListener("pointermove", ev => { if (!dragging) return; state[dragging] = posFromEvent(ev); update(); });
  $("track").addEventListener("pointerup", () => dragging = null);
  for (const k of ["a", "b"]) $(k === "a" ? "bandA" : "bandB").addEventListener("keydown", ev => {
    const d = { ArrowLeft: -.01, ArrowRight: .01, PageDown: -.05, PageUp: .05 }[ev.key]; if (!d) return;
    ev.preventDefault(); state[k] = Math.min(1, Math.max(0, state[k] + d)); clearPreset(); update();
  });
  $("size").addEventListener("input", ev => { state.w = +ev.target.value; update(); });

  const presets = [...document.querySelectorAll(".presets .chip")];
  function clearPreset() { presets.forEach(b => b.setAttribute("aria-pressed", "false")); }
  presets.forEach(b => b.addEventListener("click", () => {
    state.a = toPos(+b.dataset.a); state.b = toPos(+b.dataset.b); state.w = 0.02; $("size").value = 0.02;
    clearPreset(); b.setAttribute("aria-pressed", "true"); update();
    const want = [+b.dataset.a, +b.dataset.b];
    const i = state.chains.findIndex(c => byId.get(c[0]).y === want[0] && byId.get(c.at(-1)).y === want[1]);
    if (i > 0) { state.pick = i; render(); }
  }));

  // ----- Rendering -----
  let lastKey = "";
  function update() {
    placeBands();
    const key = eras().flat().join();
    if (key !== lastKey) { lastKey = key; state.chains = findChains(); state.pick = 0; state.step = 0; state.revealed.clear(); state.focus = null; }
    render();
  }

  function render() {
    const [A, B] = eras();
    document.querySelectorAll(".ev").forEach(c => {
      const e = byId.get(c.dataset.id);
      c.classList.toggle("in-a", e.y >= A[0] && e.y <= A[1]);
      c.classList.toggle("in-b", e.y >= B[0] && e.y <= B[1]);
      c.classList.remove("ripple"); c.style.fill = "";
    });
    $("threads").replaceChildren(); $("nodes").replaceChildren();
    document.body.classList.toggle("class-mode", state.classMode);
    state.focus ? renderRipple() : renderBridge(A, B);
  }

  function renderBridge(A, B) {
    const panel = $("panel"), chain = state.chains[state.pick];
    if (!chain) {
      panel.innerHTML = `<p class="eyebrow">No thread yet</p>
        <h2 class="q">Nothing in this atlas links <span class="a">${fmtYear(A[0])}–${fmtYear(A[1])}</span> to <span class="b">${fmtYear(B[0])}–${fmtYear(B[1])}</span></h2>
        <p class="empty">Make an era bigger with <b>Era size</b>, or drag one somewhere busier. Or click any dot on the map to see what it caused.</p>
        <div class="prompt"><b>Class challenge</b>Can your class find a connection the atlas is missing? Pick one event from each era and argue how the first could have led to the second.</div>`;
      return;
    }
    const n = chain.length, first = byId.get(chain[0]), last = byId.get(chain[n - 1]);
    const shown = state.classMode ? state.step : n - 1;
    const hidden = i => state.hide && i > 0 && i < n - 1 && !state.revealed.has(i);

    chain.slice(0, -1).forEach((id, i) => { if (i < shown) drawThread(id, chain[i + 1], "draw", state.classMode ? 0 : i * .35); });
    const placed = [];
    chain.forEach((id, i) => {
      let [x, y] = XY.get(id);
      const [x0, y0] = [x, y];
      for (let t = 0; t < 12 && placed.some(([px, py]) => Math.hypot(px - x, py - y) < 22); t++) { x = x0 + 24 * Math.cos(t * 1.1 - 1.6) * (1 + t / 6); y = y0 + 24 * Math.sin(t * 1.1 - 1.6) * (1 + t / 6); }
      placed.push([x, y]);
      if (x !== x0) el("line", { x1: x0, y1: y0, x2: x, y2: y, style: "stroke:var(--ink);stroke-width:1;opacity:.5" }, $("nodes"));
      const g = el("g", { class: "node" + (i > shown ? " dim" : ""), "data-id": id }, $("nodes"));
      el("circle", { cx: x, cy: y, r: 11, style: `fill:${mix(i / (n - 1))}` }, g);
      el("text", { x, y }, g).textContent = hidden(i) ? "?" : i + 1;
      g.addEventListener("click", () => openEvent(id));
    });

    const span = last.y - first.y;
    panel.innerHTML = `
      <div><p class="eyebrow">How are these connected? · ${n - 1} links · ${span.toLocaleString()} years</p>
      <h2 class="q">From <span class="a">${first.t}</span> to <span class="b">${last.t}</span></h2></div>
      ${state.chains.length > 1 ? `<div class="tabs" role="group" aria-label="Other threads">${state.chains.map((c, i) => `<button class="chip" data-pick="${i}" aria-pressed="${i === state.pick}">${byId.get(c[0]).t} → ${byId.get(c.at(-1)).t}</button>`).join("")}</div>` : ""}
      <div class="tools">
        <button class="btn" id="classBtn" aria-pressed="${state.classMode}">Teach step by step</button>
        <button class="btn" id="hideBtn" aria-pressed="${state.hide}">Hide the middle</button>
        ${state.classMode ? `<span class="spacer"></span><button class="btn" id="prevBtn" ${state.step === 0 ? "disabled" : ""}>← Back</button><button class="btn" id="nextBtn" ${state.step >= n - 1 ? "disabled" : ""}>Next link →</button>` : ""}
      </div>
      <ol class="steps">${chain.map((id, i) => {
        const e = byId.get(id);
        return `<li class="step${hidden(i) ? " hidden" : ""}${i > shown ? " dim" : ""}">
          <span class="num" style="background:${mix(i / (n - 1))}">${hidden(i) ? "?" : i + 1}</span>
          <div class="card"><div class="meta">${when(e)} · ${e.p}</div><h3>${e.t}</h3><p>${e.s}</p>
            ${hidden(i) ? `<button class="btn reveal" data-reveal="${i}">Reveal</button>` : ""}</div>
          ${i < n - 1 ? `<span class="rail"></span><p class="why">${hidden(i) && hidden(i + 1) ? "?" : whyOf(id, chain[i + 1])}</p>` : ""}
        </li>`;
      }).join("")}</ol>
      <div class="prompt"><b>Talk about it</b>${state.hide ? "Before you reveal: what do you think happened in between?" : `What if <em>${byId.get(chain[Math.min(1, n - 1)]).t}</em> had never happened? Would <em>${last.t}</em> still have happened, later, or somewhere else?`}</div>`;

    panel.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { state.pick = +b.dataset.pick; state.step = 0; state.revealed.clear(); render(); });
    panel.querySelectorAll("[data-reveal]").forEach(b => b.onclick = () => { state.revealed.add(+b.dataset.reveal); render(); });
    $("classBtn").onclick = () => { state.classMode = !state.classMode; state.step = 0; render(); };
    $("hideBtn").onclick = () => { state.hide = !state.hide; state.revealed.clear(); render(); };
    if (state.classMode) { $("prevBtn").onclick = () => { state.step--; render(); }; $("nextBtn").onclick = () => { state.step++; render(); }; }
  }

  function openEvent(id) { state.focus = id; tip.hidden = true; render(); }

  function renderRipple() {
    const e = byId.get(state.focus), panel = $("panel");
    // Everything downstream, one generation at a time
    const gen = new Map([[e.id, 0]]), queue = [e.id];
    while (queue.length) { const cur = queue.shift(); for (const l of out.get(cur)) if (!gen.has(l.to)) { gen.set(l.to, gen.get(cur) + 1); queue.push(l.to); } }
    const reached = [...gen.keys()].filter(k => k !== e.id), maxGen = Math.max(1, ...gen.values());
    for (const [k, g] of gen) for (const l of out.get(k)) if (gen.get(l.to) === g + 1) drawThread(k, l.to, "draw" + (g > 0 ? " faint" : ""), g * .3);
    for (const l of inn.get(e.id)) drawThread(l.from, e.id, "draw", 0);
    document.querySelectorAll(".ev").forEach(c => {
      const g = gen.get(c.dataset.id);
      c.classList.remove("in-a", "in-b");
      if (g !== undefined) { c.classList.add("ripple"); c.style.fill = g === 0 ? "var(--thread)" : mix(g / maxGen); }
    });
    const [x, y] = XY.get(e.id); el("circle", { cx: x, cy: y, r: 9, style: "fill:var(--thread)" }, $("nodes"));
    const latest = reached.length ? Math.max(...reached.map(k => byId.get(k).y)) : null;
    const item = (l, other) => { const o = byId.get(other); return `<li><button data-open="${o.id}"><span class="meta">${when(o)}</span><span class="t">${o.t}</span><span class="why2">${l.why}</span></button></li>`; };
    panel.innerHTML = `
      <div><p class="eyebrow">${when(e)} · ${e.p}</p><h2 class="q">${e.t}</h2><p>${e.s}</p></div>
      <div class="tools"><button class="btn" id="backBtn">← Back to the two eras</button></div>
      ${reached.length ? `<div><span class="stat">${reached.length}</span> later events in this atlas trace back to this, all the way to ${fmtYear(latest)}. That's the butterfly effect.</div>` : ""}
      <div><p class="eyebrow">Caused by</p>${inn.get(e.id).length ? `<ul class="list">${inn.get(e.id).map(l => item(l, l.from)).join("")}</ul>` : `<p class="empty">Nothing in this atlas yet. What do you think led to it?</p>`}</div>
      <div><p class="eyebrow">Led to</p>${out.get(e.id).length ? `<ul class="list">${out.get(e.id).map(l => item(l, l.to)).join("")}</ul>` : `<p class="empty">Nothing in this atlas yet. What might it have changed?</p>`}</div>`;
    panel.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openEvent(b.dataset.open));
    $("backBtn").onclick = () => { state.focus = null; render(); };
  }

  document.addEventListener("keydown", ev => {
    if (!state.classMode || state.focus || ev.target.closest("[role=slider]")) return;
    const n = (state.chains[state.pick] || []).length;
    if (ev.key === "ArrowRight" && state.step < n - 1) { state.step++; render(); }
    if (ev.key === "ArrowLeft" && state.step > 0) { state.step--; render(); }
  });

  presets[0].click();
})();
