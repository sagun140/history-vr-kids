(() => {
  const { EVENTS, LINKS, STORIES, MAP } = window;
  const IMAGES = window.IMAGES || {};
  const $ = id => document.getElementById(id);
  const byId = new Map(EVENTS.map(e => [e.id, e]));
  const link = (a, b) => LINKS.find(l => l.from === a && l.to === b);
  const fmtYear = y => y < 0 ? `${(-y).toLocaleString()} BCE` : y < 1000 ? `${y} CE` : `${y}`;
  const when = e => e.when || (e.ca ? "c. " : "") + fmtYear(e.y);
  const chronological = [...EVENTS].sort((a, b) => a.y - b.y).map(e => e.id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Natural Earth projection, same as land.js
  function project(lon, lat) {
    const l = lon * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2;
    const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [MAP.tx + MAP.k * x, MAP.ty - MAP.k * y];
  }

  let story = STORIES[0], ids = story.ids, index = 0, current = null;

  $("stories").innerHTML = STORIES.map(s => `<button class="chip" data-story="${s.id}">${esc(s.title)}</button>`).join("");
  $("stories").addEventListener("click", ev => { const b = ev.target.closest("[data-story]"); if (b) open(b.dataset.story, 0); });

  function open(storyId, i) {
    story = STORIES.find(s => s.id === storyId) || STORIES[0];
    ids = story.ids || chronological;
    document.querySelectorAll("[data-story]").forEach(b => b.setAttribute("aria-pressed", b.dataset.story === story.id));
    $("strip").innerHTML = ids.map((id, n) => {
      const e = byId.get(id), img = IMAGES[id];
      return `<button class="thumb" data-i="${n}"><i class="tb" ${img ? `style="background-image:url('img/${id}.jpg')"` : ""}></i><b>${esc(when(e))}</b><span>${esc(e.t)}</span></button>`;
    }).join("");
    current = null;
    go(Math.min(Math.max(0, i), ids.length - 1), 0);
  }
  $("strip").addEventListener("click", ev => { const b = ev.target.closest("[data-i]"); if (b) go(+b.dataset.i); });

  function miniMap(i) {
    const e = byId.get(ids[i]), [x, y] = project(e.lon, e.lat);
    let trail = "";
    if (i > 0) {
      const p = byId.get(ids[i - 1]), [px, py] = project(p.lon, p.lat), d = Math.hypot(x - px, y - py);
      if (d > 4) trail = `<path class="trail" d="M${px},${py} Q${(px + x) / 2},${(py + y) / 2 - Math.max(30, d * .3)} ${x},${y}"/><circle class="was" cx="${px}" cy="${py}" r="9"/>`;
    }
    return `<div class="mini" aria-hidden="true"><svg viewBox="0 0 1000 520"><path class="sea" d="${MAP.sphere}"/><path class="land" d="${MAP.land}"/>${trail}<circle class="pulse" cx="${x}" cy="${y}" r="16"/><circle class="here" cx="${x}" cy="${y}" r="14"/></svg></div>`;
  }

  function nextLine(i) {
    const id = ids[i];
    if (story.ids) {
      if (i === ids.length - 1) return `<div class="so"><small>The end of this story</small>Pick another story above, or press ← to go back.</div>`;
      const l = link(id, ids[i + 1]);
      return `<div class="so"><small>So… next: ${esc(byId.get(ids[i + 1]).t)}</small>${esc(l ? l.why : "")}</div>`;
    }
    const l = LINKS.find(k => k.from === id);
    return l ? `<div class="so"><small>This led to: ${esc(byId.get(l.to).t)}</small>${esc(l.why)}</div>` : "";
  }

  function go(i, dir = i > index ? 1 : -1) {
    if (i < 0 || i >= ids.length) return;
    index = i;
    const e = byId.get(ids[i]), img = IMAGES[e.id];
    const slide = document.createElement("article");
    slide.className = "slide" + (dir > 0 ? " from-right" : dir < 0 ? " from-left" : "");
    slide.setAttribute("aria-roledescription", "slide");
    slide.innerHTML = `
      <div class="picture">
        ${img ? `<div class="backdrop" style="background-image:url('img/${e.id}.jpg')"></div><img class="photo" src="img/${e.id}.jpg" alt="${esc(e.t)}">` : `<div class="noimg">${esc(fmtYear(e.y))}</div>`}
        ${miniMap(i)}
      </div>
      <div class="caption">
        <div class="when">${esc(when(e))}</div>
        <div class="where">${esc(e.p)}</div>
        <h2>${esc(e.t)}</h2>
        <p>${esc(e.s)}</p>
        ${nextLine(i)}
      </div>
      ${img ? `<div class="credit">Picture: ${esc(img.artist || "Unknown")} · ${esc(img.license)} · <a href="${esc(img.source)}" target="_blank" rel="noopener">Wikimedia Commons</a></div>` : ""}`;
    $("stage").appendChild(slide);
    const old = current; current = slide;
    requestAnimationFrame(() => requestAnimationFrame(() => slide.classList.add("on")));
    if (old) { old.classList.remove("on"); setTimeout(() => old.remove(), 550); }

    $("count").innerHTML = `${i + 1} / ${ids.length} <span class="hint">· press → for next</span>`;
    $("prev").disabled = i === 0; $("next").disabled = i === ids.length - 1;
    document.querySelectorAll(".thumb").forEach(t => t.setAttribute("aria-current", +t.dataset.i === i));
    document.querySelector(`.thumb[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    for (const n of [i + 1, i + 2]) if (IMAGES[ids[n]]) new Image().src = `img/${ids[n]}.jpg`;
    try { history.replaceState(null, "", `#${story.id}/${i + 1}`); } catch (_) {}
  }

  $("prev").onclick = () => go(index - 1);
  $("next").onclick = () => go(index + 1);
  document.addEventListener("keydown", ev => {
    if (ev.target.closest("input, textarea")) return;
    if (ev.key === "ArrowRight" || ev.key === " " || ev.key === "PageDown") { ev.preventDefault(); go(index + 1); }
    if (ev.key === "ArrowLeft" || ev.key === "PageUp") { ev.preventDefault(); go(index - 1); }
    if (ev.key === "Home") go(0);
    if (ev.key === "End") go(ids.length - 1);
  });
  let touchX = null;
  $("stage").addEventListener("touchstart", ev => touchX = ev.touches[0].clientX, { passive: true });
  $("stage").addEventListener("touchend", ev => {
    if (touchX === null) return;
    const dx = ev.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
  });

  const [hs, hi] = decodeURIComponent(location.hash.slice(1)).split("/");
  open(hs || STORIES[0].id, (parseInt(hi, 10) || 1) - 1);
})();
