// Run: node tools/make-og.mjs — renders the social cards and the PNG app icon
// from tools/cards.html. Only needed when the cards or the map data change;
// the PNGs are committed, so the site itself never needs this.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHROME = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('No Chrome found. Set CHROME_PATH=/path/to/chrome'); process.exit(1); }

const cards = [
  { card: 'atlas', out: 'og.png', w: 1200, h: 630 },
  { card: 'ap', out: 'og-ap.png', w: 1200, h: 630 },
  { card: 'vr', out: 'og-vr.png', w: 1200, h: 630 },
  { card: 'icon', out: 'icon-512.png', w: 512, h: 512 },
];

for (const c of cards) {
  const out = path.join(ROOT, c.out);
  const r = spawnSync(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${c.w},${c.h}`, `--screenshot=${out}`,
    '--virtual-time-budget=4000', `file://${path.join(ROOT, 'tools/cards.html')}?card=${c.card}`],
    { encoding: 'utf8' });
  const size = fs.existsSync(out) ? fs.statSync(out).size : 0;
  if (!size) { console.error(`✗ ${c.out} was not written`, (r.stderr || '').split('\n').slice(-3).join(' ')); process.exit(1); }
  console.log(`✓ ${c.out} — ${c.w}x${c.h}, ${(size / 1024).toFixed(0)} kB`);
}
