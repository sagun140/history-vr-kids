// Shared history logic: the squeezed time scale, era windows, and the search for
// chains of cause and effect between two eras. Used by app.js (the 2D atlas) and
// vr.js (the headset version) so the two can never drift apart.
// Needs data.js loaded first. No DOM, no dependencies.
(function () {
  const { EVENTS, LINKS } = window;
  const byId = new Map(EVENTS.map(e => [e.id, e]));
  const out = new Map(EVENTS.map(e => [e.id, []]));
  const inn = new Map(EVENTS.map(e => [e.id, []]));
  for (const l of LINKS) { out.get(l.from).push(l); inn.get(l.to).push(l); }

  // The deep past is squeezed so recent centuries get room on the timeline.
  const ANCHORS = [[-10000, 0], [-3000, .12], [-500, .25], [500, .37], [1000, .45], [1500, .58], [1750, .7], [1900, .83], [2025, 1]];
  const toPos = y => { for (let i = 1; i < ANCHORS.length; i++) { const [y0, p0] = ANCHORS[i - 1], [y1, p1] = ANCHORS[i]; if (y <= y1) return p0 + (p1 - p0) * (Math.max(y, y0) - y0) / (y1 - y0); } return 1; };
  const toYear = p => { for (let i = 1; i < ANCHORS.length; i++) { const [y0, p0] = ANCHORS[i - 1], [y1, p1] = ANCHORS[i]; if (p <= p1) return Math.round(y0 + (y1 - y0) * (Math.max(p, p0) - p0) / (p1 - p0)); } return 2025; };
  const fmtYear = y => y < 0 ? `${(-y).toLocaleString()} BCE` : y < 1000 ? `${y} CE` : `${y}`;
  const when = e => e.when || (e.ca ? "c. " : "") + fmtYear(e.y);
  const whyOf = (a, b) => (out.get(a).find(l => l.to === b) || {}).why || "";

  // The two era windows, earlier one first.
  const eras = ({ a, b, w }) => {
    const range = p => [toYear(Math.max(0, p - w / 2)), toYear(Math.min(1, p + w / 2))];
    const A = range(a), B = range(b);
    return A[0] <= B[0] ? [A, B] : [B, A];
  };

  // Up to `limit` distinct chains running from the earlier era to the later one.
  function findChains(state, limit = 5) {
    const [A, B] = eras(state);
    const inA = e => e.y >= A[0] && e.y <= A[1], inB = e => e.y >= B[0] && e.y <= B[1];
    const found = [];
    const walk = path => {
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
      if (chosen.length === limit) break;
    }
    return chosen;
  }

  // How many later events trace back to this one, however long the path.
  const dcache = new Map();
  function descendants(id) {
    if (dcache.has(id)) return dcache.get(id);
    const seen = new Set(), stack = [id];
    while (stack.length) for (const l of out.get(stack.pop())) if (!seen.has(l.to)) { seen.add(l.to); stack.push(l.to); }
    dcache.set(id, seen);
    return seen;
  }

  window.THREADS = { byId, out, inn, ANCHORS, toPos, toYear, fmtYear, when, whyOf, eras, findChains, descendants };
})();
