# Butterfly Atlas

Nothing in history happens alone. Butterfly Atlas is a world map for kids and teachers: drag a **Then** era and a **Now** era along the timeline, and it traces the threads of cause and effect between them, across every continent.

- **Two eras, one thread.** Paper in Han China → paper mills in Italy → Gutenberg → Galileo → Newton → the Moon landing.
- **Butterfly effect.** Click any dot to see what caused it, what it led to, and how many later events trace back to it.
- **Teach step by step.** One link at a time, with big type for projectors and arrow-key control.
- **Hide the middle.** Show only the start and end, and let the class guess the links before revealing them.

Three ways in, all free, no sign-up, no build step:

| | | |
|---|---|---|
| **`index.html`** | The atlas | The map, the timeline, and the threads. |
| **`ap.html`** | AP practice kit | A full AP World History: Modern practice exam, scored. |
| **`vr.html`** | VR | The same history as a map table you stand at, for the Meta Quest browser. |

Open `index.html` in a browser. There's no build step and nothing to install.

## The AP World History kit

`ap.html` is a complete practice exam, built on the same history as the map:

- **55 stimulus-based multiple-choice questions** in 19 sets across all nine units, 55 minutes, with a reason given for every option — not just the right one.
- **4 short-answer questions** (answer 1 and 2, then 3 or 4), with the answers that would earn each point.
- **A seven-document DBQ** and **three long-essay options**, each with the real rubric broken into checks you can score yourself against.
- **Exam mode** runs the real per-section clocks and hides all feedback until the end. **Practice mode** explains as you go.
- A **score report** weights the sections the way the exam does (40/20/25/15), predicts a 1–5, and breaks your multiple choice down by unit and by historical thinking skill.
- Every question links back to the event on the map, so a missed question becomes something to look at rather than something to memorize.
- **Print the exam** or **print it with the answer key** for a class set.

Nothing is uploaded: answers live in your own browser and clearing site data clears them.

This kit is **unofficial** and is not affiliated with or endorsed by the College Board. Every stimulus is an original paraphrase, summary or adapted table written for this project — nothing is a verbatim excerpt of a historical document, and no figure in it should be cited as data. Questions follow the published course framework.

## VR, and how to try it in a Quest

`vr.html` is the atlas as a room. You stand at a map the size of a dining table, every event a dot on it sized by how much of what followed traces back to it. Pick two moments and the chains of cause and effect arc up off the map in three dimensions. Then **walk the thread**: the map fades and the chain becomes a corridor of events receding into the dark, one station per link, which you step through at your own pace.

- Point with either controller, or with your hands — point and pinch.
- Nothing moves you without asking, and walking snaps station to station rather than sliding, which is what makes people ill.
- Narration reads each card aloud.
- It runs on a laptop too, with the mouse and `W A S D`, which is the fastest way to work on it.

**In the headset:** open the **Browser** app on the Quest, go to the page's `https://` address, and press **Enter VR**. WebXR needs a secure connection, so a `file://` copy will show the map but will not enter VR. Pushing to `main` publishes to GitHub Pages, which gives you that https address:

```
https://<your-user>.github.io/history-vr-kids/vr.html
```

One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

To try a local build in the headset, serve the folder over your network and use an https tunnel, or sideload via `adb reverse` — `python3 -m http.server 8000` plus `adb reverse tcp:8000 tcp:8000` makes `http://localhost:8000/vr.html` work in the Quest browser, and `localhost` counts as secure.

A-Frame loads from a CDN. If you need the page to work with no internet at all, download `aframe-master.min.js` next to the page and point the last `<script src=…>` at it.

## Adding history

Everything lives in `data.js`: add an event with `ev(...)`, connect it with `ln(from, to, "why")`, then run `node check.mjs` to catch unknown ids and links that go backwards in time.

Questions live in `apdata.js`: add a set with `set(id, unit, st(source, body), q(...), q(...))`, then run `node apcheck.mjs`. Write the choices in whatever order reads best — the order is shuffled deterministically per question so the answer key stays evenly spread across A/B/C/D without anyone planning it.

The atlas holds 189 events and 209 links: a starting set, not all of history. Links are simplified for kids; several are marked as debated in their wording ("some historians think").

## Checks

```
node check.mjs      # every link points at a real event and runs forward in time
node apcheck.mjs    # question bank: four options, rubrics add up, key is spread, atlas links resolve
node smoke.mjs      # drives all three pages in a real headless browser
```

`smoke.mjs` needs a Chrome or Chromium somewhere it can find (or `CHROME_PATH=…`), and skips quietly if there is none. To exercise the VR scene with no network, point it at a local copy of A-Frame:

```
AFRAME_LOCAL=/path/to/aframe-master.min.js node smoke.mjs
```

## Files

```
index.html app.js      the atlas
ap.html    ap.js       the AP exam engine
vr.html    vr.js       the headset version
data.js                the history: events and the links between them
apdata.js              the AP question bank
threads.js             the time scale and the chain search, shared by the atlas and VR
land.js                the world map, as path data
theme.css              colours, type and the cross-page nav
tools/make-pages.mjs   one readable page per event, plus the sitemap (CI runs this)
tools/make-og.mjs      the social cards and the app icon
```

`e/` and `sitemap.xml` are generated before each deploy rather than committed, so they can never fall out of step with `data.js`.

Map: Natural Earth via [world-atlas](https://github.com/topojson/world-atlas) (public domain).
