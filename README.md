# Butterfly Atlas

Nothing in history happens alone. Butterfly Atlas tells world history as picture stories: press → and each photo or painting leads to the next, with a line saying how one thing caused the other and a little world map showing where it happened.

- **Picture stories** (`index.html`): 9 stories like *How paper got us to the Moon* and *The volcano that made a monster*, plus *All of history, in order* (189 slides). Arrow keys, on-screen arrows, or swipe. Share a slide with its link, e.g. `#paper/5`.
- **Compare two eras** (`atlas.html`): drag a **Then** era and a **Now** era along the timeline and it traces the threads between them on a world map.

- **Two eras, one thread.** Paper in Han China → paper mills in Italy → Gutenberg → Galileo → Newton → the Moon landing.
- **Butterfly effect.** Click any dot to see what caused it, what it led to, and how many later events trace back to it.
- **Teach step by step.** One link at a time, with big type for projectors and arrow-key control.
- **Hide the middle.** Show only the start and end, and let the class guess the links before revealing them.

Open `index.html` in a browser. There's no build step.

## Pictures

Every picture comes from Wikimedia Commons under a free license (public domain, CC0, CC BY, CC BY-SA), credited on its slide. `python3 tools/fetch_images.py` downloads them from `tools/articles.json` (one Wikipedia article per event); `tools/overrides.json` pins a better Commons file or search. Then run `python3 tools/build_images_js.py` to rebuild the credits.

## Adding history

Everything lives in `data.js`: add an event with `ev(...)`, connect it with `ln(from, to, "why")`, then run `node check.mjs` to catch unknown ids, links that go backwards in time, and story steps that aren't linked. To add a story, list linked event ids in `stories.js`.

The atlas holds 189 events and 209 links: a starting set, not all of history. Links are simplified for kids; several are marked as debated in their wording ("some historians think").

Map: Natural Earth via [world-atlas](https://github.com/topojson/world-atlas) (public domain).
