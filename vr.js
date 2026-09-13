// Butterfly Atlas VR — the atlas as a table you stand at, in a headset.
//
// The design, in one paragraph: you stand at a map the size of a dining table.
// Every event in data.js is a dot on it, sized by how much of what followed
// traces back to it. Pick a Then and a Now on the timeline at the near edge and
// the chains of cause and effect lift off the map as arcs you can lean into —
// the thing a flat screen cannot do. Then "walk the thread" and the map fades
// into a corridor of events receding into the dark, one station per link, which
// you step through at your own pace. Nothing moves you without your asking.
//
// Needs: A-Frame, land.js (the map paths), data.js (the history), threads.js.
(() => {
  if (!window.AFRAME) return;
  const T = window.THREADS, MAP = window.MAP, EVENTS = window.EVENTS;
  const { byId, toPos, toYear, when, whyOf, eras, findChains, descendants } = T;

  // Table size in metres. The map keeps land.js's 1000x520 proportions.
  const TW = 1.9, TD = TW * MAP.h / MAP.w, LIFT = 0.012;
  const INK = "#e8f1f7", SEA = "#15324b", LAND = "#f5dd8f";
  const C = { then: "#ff922b", now: "#4dabf7", thread: "#f06595", dot: "#7d93a8", panel: "#102232", hair: "#2b4a66" };
  const FONT = '"Nunito", "Segoe UI", system-ui, sans-serif';
  const MONO = '"DM Mono", ui-monospace, monospace';

  // ---------- the same Natural Earth projection the flat atlas uses ----------
  const project = (lon, lat) => {
    const l = lon * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2;
    const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [MAP.tx + MAP.k * x, MAP.ty - MAP.k * y];
  };
  // map pixel space -> table local metres (x right, z toward the player)
  const onTable = (lon, lat) => { const [x, y] = project(lon, lat); return [(x / MAP.w - 0.5) * TW, (y / MAP.h - 0.5) * TD]; };

  // ---------- canvas helpers ----------
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  function mapCanvas() {
    const c = canvas(2048, Math.round(2048 * MAP.h / MAP.w)), g = c.getContext("2d"), s = c.width / MAP.w;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.fillStyle = SEA; g.fill(new Path2D(MAP.sphere));
    g.strokeStyle = "rgba(160,200,225,.28)"; g.lineWidth = 0.7; g.stroke(new Path2D(MAP.grat));
    g.fillStyle = LAND; g.fill(new Path2D(MAP.land));
    g.strokeStyle = "rgba(120,90,30,.45)"; g.lineWidth = 0.6; g.stroke(new Path2D(MAP.land));
    g.strokeStyle = "rgba(160,200,225,.5)"; g.lineWidth = 1.4; g.stroke(new Path2D(MAP.sphere));
    return c;
  }

  // Wrapped text, returns the y it finished at.
  function wrap(g, text, x, y, w, lh) {
    let line = "";
    for (const word of String(text).split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (g.measureText(test).width > w && line) { g.fillText(line, x, y); y += lh; line = word; } else line = test;
    }
    if (line) { g.fillText(line, x, y); y += lh; }
    return y;
  }

  // A card: title, meta line, body, optional "so..." line and a footer.
  function cardCanvas(o) {
    const W = 1024, H = o.tall ? 700 : 560, c = canvas(W, H), g = c.getContext("2d");
    g.fillStyle = C.panel; g.globalAlpha = .97;
    g.beginPath(); g.roundRect(0, 0, W, H, 40); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = o.accent || C.thread; g.lineWidth = 10;
    g.beginPath(); g.roundRect(5, 5, W - 10, H - 10, 38); g.stroke();
    let y = 92;
    if (o.kicker) { g.fillStyle = o.accent || C.thread; g.font = `800 30px ${FONT}`; g.fillText(o.kicker.toUpperCase(), 54, y); y += 18; }
    g.fillStyle = INK; g.font = `800 62px ${FONT}`; y = wrap(g, o.title, 54, y + 50, W - 108, 68);
    if (o.meta) { g.fillStyle = "#9bb0c3"; g.font = `500 34px ${MONO}`; y = wrap(g, o.meta, 54, y + 28, W - 108, 42); }
    if (o.body) { g.fillStyle = INK; g.font = `400 38px ${FONT}`; y = wrap(g, o.body, 54, y + 44, W - 108, 50); }
    if (o.why) { g.fillStyle = C.thread; g.font = `700 36px ${FONT}`; y = wrap(g, "so… " + o.why, 54, y + 40, W - 108, 46); }
    if (o.foot) { g.fillStyle = "#9bb0c3"; g.font = `500 28px ${MONO}`; wrap(g, o.foot, 54, H - 46, W - 108, 34); }
    return c;
  }

  function buttonCanvas(label, sub, accent) {
    const W = 512, H = 160, c = canvas(W, H), g = c.getContext("2d");
    g.fillStyle = C.panel; g.beginPath(); g.roundRect(0, 0, W, H, 34); g.fill();
    g.strokeStyle = accent || C.hair; g.lineWidth = 8; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 32); g.stroke();
    g.fillStyle = INK; g.font = `800 ${sub ? 46 : 52}px ${FONT}`; g.textAlign = "center";
    g.fillText(label, W / 2, sub ? 78 : 98);
    if (sub) { g.fillStyle = accent || "#9bb0c3"; g.font = `500 32px ${MONO}`; g.fillText(sub, W / 2, 124); }
    return c;
  }

  function timelineCanvas(state) {
    const W = 2048, H = 190, c = canvas(W, H), g = c.getContext("2d");
    const pad = 70, span = W - pad * 2, mark = p => pad + p * span;
    g.fillStyle = C.panel; g.beginPath(); g.roundRect(0, 0, W, H, 30); g.fill();
    g.strokeStyle = C.hair; g.lineWidth = 5; g.beginPath(); g.roundRect(3, 3, W - 6, H - 6, 28); g.stroke();
    g.strokeStyle = "rgba(155,176,195,.55)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(pad, 118); g.lineTo(W - pad, 118); g.stroke();
    g.fillStyle = "#9bb0c3"; g.font = `500 26px ${MONO}`; g.textAlign = "center";
    for (const [year] of T.ANCHORS) {
      const x = mark(toPos(year));
      g.fillRect(x - 1.5, 100, 3, 18);
      g.fillText(T.fmtYear(year), x, 162);
    }
    for (const [key, col, label] of [["a", C.then, "THEN"], ["b", C.now, "NOW"]]) {
      const x = mark(state[key]), w = Math.max(26, state.w * span);
      g.fillStyle = col; g.globalAlpha = .35; g.fillRect(x - w / 2, 92, w, 32); g.globalAlpha = 1;
      g.fillStyle = col; g.beginPath(); g.roundRect(x - 92, 22, 184, 52, 18); g.fill();
      g.fillStyle = "#07121d"; g.font = `800 34px ${FONT}`;
      g.fillText(label + " " + T.fmtYear(toYear(state[key])), x, 60);
    }
    return c;
  }

  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  function planeMesh(c, w, h, opts = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, alphaTest: opts.alphaTest || 0, side: opts.side || THREE.FrontSide, depthWrite: opts.depthWrite !== false }));
    return m;
  }
  const retexture = (mesh, c) => { mesh.material.map.dispose(); mesh.material.map = tex(c); mesh.material.needsUpdate = true; };

  // ---------- the scene ----------
  AFRAME.registerComponent("atlas", {
    init() {
      const scene = this.el;
      this.state = { a: toPos(105), b: toPos(1969), w: 0.05, chains: [], pick: 0, focus: null, narrate: false, mode: "map", step: 0 };
      this.hover = -1;
      this.raycaster = new THREE.Raycaster();
      this.ui = [];

      this.buildFloor();
      this.buildTable();
      this.buildPins();
      this.buildConsole();
      this.buildPresets();
      this.buildCard();
      this.corridor = document.getElementById("corridor").object3D;

      this.recompute();

      // Pointer sources, in the order we trust them: controllers, hands, then mouse/gaze.
      this.pointers = ["rhand", "lhand", "rhandtrack", "lhandtrack", "gaze"].map(id => document.getElementById(id)).filter(Boolean);
      // Any press, from any pointer, opens whatever dot is under it.
      for (const ev of ["triggerdown", "pinchstarted", "mousedown"]) scene.addEventListener(ev, () => this.pressPin());
      window.addEventListener("keydown", e => {
        if (e.key === "n" || e.key === "N") this.toggleNarrate();
        if (e.key === "ArrowRight") this.walkStep(1);
        if (e.key === "ArrowLeft") this.walkStep(-1);
      });

      const overlay = document.getElementById("overlay"), hud = document.getElementById("hud");
      document.getElementById("enter").addEventListener("click", () => { overlay.classList.add("gone"); hud.classList.add("on"); });
      this.hud = hud;
      this.sayHud("Point at a dot. Tap a preset on the left. Press N to read aloud.");
    },

    // ---- room ----
    buildFloor() {
      const g = new THREE.BufferGeometry(), pts = [], n = 24, s = 0.6;
      for (let i = -n; i <= n; i++) { pts.push(-n * s, 0.002, i * s, n * s, 0.002, i * s, i * s, 0.002, -n * s, i * s, 0.002, n * s); }
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1d3b55 }));
      document.getElementById("grid").object3D.add(lines);
    },

    buildTable() {
      const host = document.getElementById("table").object3D;
      const map = planeMesh(mapCanvas(), TW, TD, { alphaTest: 0.04, side: THREE.DoubleSide });
      map.rotation.x = -Math.PI / 2;
      host.add(map);
      // a thin rim so the table reads as an object, not a floating decal
      const rim = new THREE.Mesh(new THREE.TorusGeometry(TW * 0.52, 0.006, 6, 64),
        new THREE.MeshBasicMaterial({ color: 0x2b4a66 }));
      rim.rotation.x = -Math.PI / 2; rim.scale.z = TD / TW * 1.04; rim.visible = false;
      host.add(rim);
      this.threadGroup = new THREE.Group(); host.add(this.threadGroup);
      this.labelGroup = new THREE.Group(); host.add(this.labelGroup);
      this.tableHost = host;
    },

    // Every event as one instanced dot: 189 of them in a single draw call.
    buildPins() {
      const geo = new THREE.SphereGeometry(1, 8, 6);
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      const mesh = new THREE.InstancedMesh(geo, mat, EVENTS.length);
      const m = new THREE.Matrix4(), col = new THREE.Color();
      const span = Math.max(...EVENTS.map(e => descendants(e.id).size)) || 1;
      this.pinPos = [];
      EVENTS.forEach((e, i) => {
        const [x, z] = onTable(e.lon, e.lat);
        const r = 0.009 + 0.016 * Math.sqrt(descendants(e.id).size / span);
        this.pinPos.push({ x, z, r, id: e.id });
        m.makeScale(r, r, r); m.setPosition(x, LIFT + r, z);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, col.set(C.dot));
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.tableHost.add(mesh);
      this.pins = mesh;
      this.pinIndex = new Map(EVENTS.map((e, i) => [e.id, i]));
    },

    buildConsole() {
      const host = document.getElementById("console");
      const mesh = planeMesh(timelineCanvas(this.state), TW, TW * 190 / 2048);
      host.object3D.add(mesh);
      this.timeMesh = mesh;
      // the clickable surface is an a-plane so A-Frame's own raycaster gives us UVs
      const hit = document.createElement("a-plane");
      hit.setAttribute("width", TW); hit.setAttribute("height", TW * 190 / 2048);
      hit.setAttribute("material", "opacity: 0; transparent: true");
      hit.setAttribute("class", "ui");
      hit.addEventListener("click", e => {
        const uv = e.detail.intersection && e.detail.intersection.uv; if (!uv) return;
        const p = Math.min(1, Math.max(0, (uv.x - 70 / 2048) / (1 - 140 / 2048)));
        const key = Math.abs(p - this.state.a) <= Math.abs(p - this.state.b) ? "a" : "b";
        this.state[key] = p; this.recompute();
        this.sayHud(`${key === "a" ? "Then" : "Now"} moved to ${T.fmtYear(toYear(p))}`);
      });
      host.appendChild(hit);
    },

    buildPresets() {
      const host = document.getElementById("presets");
      this.presetDefs = [
        { label: "Paper → the Moon", a: 105, b: 1969 },
        { label: "Volcano → Frankenstein", a: 1815, b: 1818 },
        { label: "Tea → a revolution", a: 760, b: 1776 },
        { label: "Horses → silver", a: -2200, b: 1545 },
        { label: "An essay → Mandela", a: 1849, b: 1994 },
      ];
      const mk = (label, sub, accent, y, onClick) => {
        const el = document.createElement("a-plane");
        el.setAttribute("width", 0.46); el.setAttribute("height", 0.145);
        el.setAttribute("position", `0 ${y} 0`);
        el.setAttribute("class", "ui");
        el.setAttribute("material", "shader: flat; transparent: true");
        el.addEventListener("loaded", () => {
          el.getObject3D("mesh").material.map = tex(buttonCanvas(label, sub, accent));
          el.getObject3D("mesh").material.needsUpdate = true;
        });
        el.addEventListener("click", onClick);
        host.appendChild(el);
        return el;
      };
      let y = 0.42;
      this.presetDefs.forEach(p => {
        mk(p.label, null, null, y, () => { this.state.a = toPos(p.a); this.state.b = toPos(p.b); this.recompute(); this.sayHud(p.label); });
        y -= 0.165;
      });
      y -= 0.06;
      this.walkBtn = mk("Walk the thread", "step through it", C.thread, y, () => this.toggleWalk());
      y -= 0.165;
      this.narrateBtn = mk("Read aloud", "off", C.now, y, () => this.toggleNarrate());
    },

    buildCard() {
      const host = document.getElementById("cardholder").object3D;
      const mesh = planeMesh(cardCanvas({ title: "Point at a dot", body: "Every dot is something that happened. The bigger it is, the more of what came later traces back to it." }), 0.72, 0.72 * 560 / 1024);
      mesh.position.set(0, 0.1, 0);
      host.add(mesh);
      this.card = mesh;
      this.cardHost = host;
    },

    // ---------- state changes ----------
    // The chain that best answers the two moments you picked: the one whose ends
    // sit closest to them. Without this, "volcano to Frankenstein" can hand you
    // some other perfectly valid thread that happens to be shorter.
    lead() { return this.state.chains[this.state.pick] || this.state.chains[0]; },

    bestChain() {
      const s = this.state, wantA = toYear(s.a), wantB = toYear(s.b);
      let best = 0, score = Infinity;
      s.chains.forEach((c, i) => {
        const d = Math.abs(byId.get(c[0]).y - wantA) + Math.abs(byId.get(c.at(-1)).y - wantB);
        if (d < score) { score = d; best = i; }
      });
      return best;
    },

    recompute() {
      const s = this.state;
      s.chains = findChains(s, 5);
      s.pick = this.bestChain();
      retexture(this.timeMesh, timelineCanvas(s));
      this.colorPins();
      this.drawThreads();
      const [A, B] = eras(s);
      if (!s.chains.length) this.showCard({ kicker: "No thread yet", title: "Nothing links these two moments", body: `Try moving Then or Now, or widen the eras. ${T.fmtYear(A[0])}–${T.fmtYear(A[1])} to ${T.fmtYear(B[0])}–${T.fmtYear(B[1])}.` });
      else this.showChainCard();
      if (s.mode === "walk") this.buildCorridor();
    },

    colorPins() {
      const s = this.state, [A, B] = eras(s), col = new THREE.Color();
      const inChain = new Set((this.lead() || []).flat ? this.lead() : []);
      EVENTS.forEach((e, i) => {
        const c = this.hover === i ? "#ffffff"
          : inChain.has(e.id) ? C.thread
          : e.y >= A[0] && e.y <= A[1] ? C.then
          : e.y >= B[0] && e.y <= B[1] ? C.now : C.dot;
        this.pins.setColorAt(i, col.set(c));
      });
      this.pins.instanceColor.needsUpdate = true;
    },

    drawThreads() {
      const g = this.threadGroup;
      while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); c.material.dispose(); }
      this.labelGroup.clear();
      this.grow = [];
      const s = this.state;
      s.chains.forEach((chain, ci) => {
        const lead = ci === s.pick;
        for (let i = 0; i < chain.length - 1; i++) {
          const p = this.pinPos[this.pinIndex.get(chain[i])], q = this.pinPos[this.pinIndex.get(chain[i + 1])];
          const a = new THREE.Vector3(p.x, LIFT + p.r, p.z), b = new THREE.Vector3(q.x, LIFT + q.r, q.z);
          const d = a.distanceTo(b);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          mid.y += Math.max(0.06, d * 0.42) * (lead ? 1 : 0.7);
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, lead ? 0.0055 : 0.003, 6, false),
            new THREE.MeshBasicMaterial({ color: C.thread, transparent: true, opacity: lead ? 1 : 0.3 }));
          tube.geometry.setDrawRange(0, 0);
          g.add(tube);
          this.grow.push({ mesh: tube, total: tube.geometry.index.count, t: -i * 0.12 - ci * 0.1 });
        }
        if (lead) chain.forEach((id, i) => this.addNodeLabel(id, i + 1, chain.length));
      });
    },

    addNodeLabel(id, n, of) {
      const e = byId.get(id), p = this.pinPos[this.pinIndex.get(id)];
      const c = canvas(512, 128), g = c.getContext("2d");
      g.fillStyle = "rgba(16,34,50,.92)"; g.beginPath(); g.roundRect(0, 0, 512, 128, 28); g.fill();
      g.strokeStyle = C.thread; g.lineWidth = 6; g.beginPath(); g.roundRect(3, 3, 506, 122, 26); g.stroke();
      g.fillStyle = C.thread; g.font = `500 34px ${MONO}`; g.textAlign = "left"; g.fillText(`${n}/${of}`, 22, 52);
      g.fillStyle = INK; g.font = `800 40px ${FONT}`;
      const t = e.t.length > 20 ? e.t.slice(0, 19) + "…" : e.t;
      g.fillText(t, 22, 100);
      const m = planeMesh(c, 0.2, 0.05);
      m.position.set(p.x, LIFT + 0.16 + (n % 2) * 0.07, p.z);
      m.userData.billboard = true;
      this.labelGroup.add(m);
    },

    showChainCard() {
      const chain = this.lead();
      const first = byId.get(chain[0]), last = byId.get(chain.at(-1));
      this.showCard({
        kicker: `${chain.length} steps · ${this.state.chains.length} thread${this.state.chains.length > 1 ? "s" : ""} found`,
        title: `${first.t} → ${last.t}`,
        meta: `${when(first)} to ${when(last)}`,
        body: chain.map((id, i) => `${i + 1}. ${byId.get(id).t}`).join("   "),
        foot: "Point at any dot for its own story. Tap Walk the thread to step through this one.",
      });
      this.narrate(`${first.t}, ${when(first)}. ${chain.length} steps later: ${last.t}.`);
    },

    showCard(o) {
      retexture(this.card, cardCanvas(o));
      this.card.material.map.needsUpdate = true;
    },

    openEvent(i) {
      const e = EVENTS[i], ds = descendants(e.id).size;
      const causes = T.inn.get(e.id).slice(0, 3).map(l => byId.get(l.from).t);
      const leads = T.out.get(e.id).slice(0, 3).map(l => byId.get(l.to).t);
      this.showCard({
        kicker: (window.KINDS || {})[e.k],
        title: e.t, meta: `${when(e)} · ${e.p}`, body: e.s,
        foot: `${ds} later events trace back to this.` + (causes.length ? ` After: ${causes.join(", ")}.` : "") + (leads.length ? ` Led to: ${leads.join(", ")}.` : ""),
      });
      this.state.focus = e.id;
      this.narrate(`${e.t}. ${when(e)}, ${e.p}. ${e.s}`);
    },

    pressPin() { if (this.hover >= 0) this.openEvent(this.hover); },

    // ---------- walking the thread ----------
    toggleWalk() {
      if (!this.state.chains.length) { this.sayHud("Pick two moments that are linked first."); return; }
      this.state.mode = this.state.mode === "walk" ? "map" : "walk";
      this.state.step = 0;
      const walking = this.state.mode === "walk";
      document.getElementById("table").setAttribute("visible", !walking);
      document.getElementById("console").setAttribute("visible", !walking);
      document.getElementById("corridor").setAttribute("visible", walking);
      document.getElementById("cardholder").setAttribute("visible", !walking);
      if (walking) this.buildCorridor(); else this.moveRig(0);
      this.sayHud(walking ? "Walk the thread: press → or tap Next. The chain runs away from you." : "Back at the map.");
    },

    buildCorridor() {
      const host = this.corridor;
      while (host.children.length) host.remove(host.children[0]);
      const chain = this.lead(), GAP = 1.9;
      chain.forEach((id, i) => {
        const e = byId.get(id), z = -1.6 - i * GAP;
        const card = planeMesh(cardCanvas({
          kicker: `Step ${i + 1} of ${chain.length}`, title: e.t, meta: `${when(e)} · ${e.p}`, body: e.s,
          why: i ? whyOf(chain[i - 1], id) : "", tall: true,
        }), 1.15, 1.15 * 700 / 1024);
        card.position.set(0, 1.5, z);
        host.add(card);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 48),
          new THREE.MeshBasicMaterial({ color: i === 0 ? C.then : i === chain.length - 1 ? C.now : C.thread }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.01, z + 1.3);
        host.add(ring);
        if (i) {
          const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, z + GAP), new THREE.Vector3(0, 0.02, z)]);
          host.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: C.thread })));
        }
      });
      this.corridorSteps = chain.length;
      this.moveRig(0);
      if (!this.walkUI) this.buildWalkUI();
      document.getElementById("walkui").setAttribute("visible", true);
    },

    buildWalkUI() {
      const wrapEl = document.createElement("a-entity");
      wrapEl.id = "walkui";
      wrapEl.setAttribute("position", "0 1.05 -0.7");
      const mk = (label, x, fn) => {
        const el = document.createElement("a-plane");
        el.setAttribute("width", 0.3); el.setAttribute("height", 0.1);
        el.setAttribute("position", `${x} 0 0`);
        el.setAttribute("class", "ui");
        el.setAttribute("material", "shader: flat; transparent: true");
        el.addEventListener("loaded", () => {
          el.getObject3D("mesh").material.map = tex(buttonCanvas(label, null, C.thread));
          el.getObject3D("mesh").material.needsUpdate = true;
        });
        el.addEventListener("click", fn);
        wrapEl.appendChild(el);
      };
      mk("← Back", -0.36, () => this.walkStep(-1));
      mk("Next →", 0, () => this.walkStep(1));
      mk("To the map", 0.36, () => this.toggleWalk());
      document.getElementById("rig").appendChild(wrapEl);
      this.walkUI = wrapEl;
    },

    walkStep(d) {
      if (this.state.mode !== "walk") return;
      this.state.step = Math.min(this.corridorSteps - 1, Math.max(0, this.state.step + d));
      this.moveRig(this.state.step);
      const chain = this.lead(), id = chain[this.state.step], e = byId.get(id);
      this.sayHud(`${this.state.step + 1}/${this.corridorSteps} · ${e.t} · ${when(e)}`);
      const why = this.state.step ? whyOf(chain[this.state.step - 1], id) : "";
      this.narrate(`${e.t}. ${e.s} ${why ? "So… " + why : ""}`);
    },

    // Snap, never slide: sliding is what makes people ill.
    moveRig(step) {
      const rig = document.getElementById("rig").object3D;
      rig.position.set(0, 0, this.state.mode === "walk" ? -step * 1.9 : 0);
    },

    // ---------- narration ----------
    toggleNarrate() {
      this.state.narrate = !this.state.narrate;
      const mesh = this.narrateBtn.getObject3D("mesh");
      if (mesh) { mesh.material.map = tex(buttonCanvas("Read aloud", this.state.narrate ? "on" : "off", C.now)); mesh.material.needsUpdate = true; }
      this.sayHud(this.state.narrate ? "Narration on." : "Narration off.");
      if (!this.state.narrate && window.speechSynthesis) speechSynthesis.cancel();
    },
    narrate(text) {
      if (!this.state.narrate || !window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 1.05;
      speechSynthesis.speak(u);
    },
    sayHud(msg) { if (this.hud) this.hud.textContent = msg; },

    // ---------- per frame ----------
    tick(time, dt) {
      // grow the threads in, one link after another
      if (this.grow && this.grow.length) {
        const step = (dt || 16) / 700;
        let busy = false;
        for (const g of this.grow) {
          g.t += step;
          const p = Math.min(1, Math.max(0, g.t));
          g.mesh.geometry.setDrawRange(0, Math.floor(g.total * p / 3) * 3);
          if (p < 1) busy = true;
        }
        if (!busy) this.grow = [];
      }
      // labels face the viewer
      const cam = this.el.camera;
      if (cam && this.labelGroup) {
        const p = new THREE.Vector3();
        for (const m of this.labelGroup.children) { cam.getWorldPosition(p); m.parent.worldToLocal(p); m.lookAt(p); }
      }
      // which dot is under the pointer?
      if (this.state.mode === "map") this.hoverTest();
    },

    hoverTest() {
      let hit = -1;
      for (const el of this.pointers) {
        const rc = el.components && el.components.raycaster;
        if (!rc || !rc.raycaster) continue;
        if (el.id !== "gaze" && !this.isTracked(el)) continue;
        if (rc.intersectedEls && rc.intersectedEls.length) break; // a button is in the way
        const hits = rc.raycaster.intersectObject(this.pins, false);
        if (hits.length && hits[0].instanceId != null) { hit = hits[0].instanceId; break; }
      }
      if (hit !== this.hover) { this.hover = hit; this.colorPins(); }
    },

    isTracked(el) {
      const tc = el.components && el.components["tracked-controls"];
      if (tc && tc.controller) return true;
      const ht = el.components && el.components["hand-tracking-controls"];
      return !!(ht && ht.mesh && ht.mesh.visible);
    },
  });
})();
