# Butterfly Atlas

Nothing in history happens alone. Butterfly Atlas is a world map for kids and teachers: drag a **Then** era and a **Now** era along the timeline, and it traces the threads of cause and effect between them, across every continent.

- **Two eras, one thread.** Paper in Han China → paper mills in Italy → Gutenberg → Galileo → Newton → the Moon landing.
- **Butterfly effect.** Click any dot to see what caused it, what it led to, and how many later events trace back to it.
- **Teach step by step.** One link at a time, with big type for projectors and arrow-key control.
- **Hide the middle.** Show only the start and end, and let the class guess the links before revealing them.

Open `index.html` in a browser. There's no build step.

## Adding history

Everything lives in `data.js`: add an event with `ev(...)`, connect it with `ln(from, to, "why")`, then run `node check.mjs` to catch unknown ids and links that go backwards in time.

The atlas holds 189 events and 209 links: a starting set, not all of history. Links are simplified for kids; several are marked as debated in their wording ("some historians think").

Map: Natural Earth via [world-atlas](https://github.com/topojson/world-atlas) (public domain).
