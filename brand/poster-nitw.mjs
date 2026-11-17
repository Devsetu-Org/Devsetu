// Cinematic DevSetu pilot poster (Apple-launch composition).
// Usage: node brand/poster-nitw.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir, homedir } from 'node:os';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'social');
const TMP = join(tmpdir(), 'devsetu-poster-nitw');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// A4 @ 300 DPI (was A3 3508×4961)
const W = 2480;
const H = 3508;
const S = W / 3508; // scale from original A3 layout
const px = (n) => Math.round(n * S);

const EMERALD = '#10b981';
const EMERALD_BRIGHT = '#34d399';
const SKY = '#38bdf8';
const INK = '#f4f6ff';

const markSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" fill="none">
  <g stroke="rgba(244,246,255,0.95)" stroke-width="5.8" stroke-linecap="round" stroke-linejoin="round">
    <line x1="32" y1="16" x2="14" y2="48" />
    <line x1="32" y1="16" x2="50" y2="48" />
    <line x1="14" y1="48" x2="50" y2="48" />
  </g>
  <circle cx="32" cy="16" r="7" fill="${SKY}" />
  <circle cx="14" cy="48" r="7" fill="${EMERALD_BRIGHT}" />
  <circle cx="50" cy="48" r="7" fill="${EMERALD_BRIGHT}" />
</svg>`;

const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=block" rel="stylesheet" />
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    background:
      radial-gradient(ellipse 90% 55% at 50% 8%, rgba(80,170,255,0.20), transparent 55%),
      radial-gradient(ellipse 70% 50% at 50% 18%, rgba(180,220,255,0.16), transparent 50%),
      radial-gradient(ellipse 100% 40% at 50% 100%, rgba(16,185,129,0.10), transparent 55%),
      #010308;
    font-family: 'Satoshi', -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: ${INK};
  }
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }

  /* Vertical beam from logo down onto platform */
  .beam {
    position: absolute;
    top: ${px(520)}px;
    left: 50%;
    width: ${px(720)}px;
    height: ${px(2800)}px;
    transform: translateX(-50%);
    background: linear-gradient(
      180deg,
      rgba(220,235,255,0.55) 0%,
      rgba(100,180,255,0.22) 18%,
      rgba(56,189,248,0.10) 40%,
      rgba(16,185,129,0.06) 65%,
      transparent 100%
    );
    filter: blur(${px(28)}px);
    clip-path: polygon(38% 0, 62% 0, 92% 100%, 8% 100%);
    opacity: 0.9;
    pointer-events: none;
  }
  .beam-core {
    position: absolute;
    top: ${px(560)}px;
    left: 50%;
    width: ${px(8)}px;
    height: ${px(2200)}px;
    transform: translateX(-50%);
    background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(56,189,248,0.35), transparent);
    filter: blur(${px(3)}px);
    opacity: 0.7;
    pointer-events: none;
  }

  .top {
    position: relative;
    z-index: 2;
    margin-top: ${px(420)}px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .halo {
    position: absolute;
    top: -${px(180)}px;
    width: ${px(900)}px;
    height: ${px(900)}px;
    border-radius: 50%;
    background:
      radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(160,210,255,0.35) 18%, rgba(56,189,248,0.16) 38%, transparent 68%);
    filter: blur(${px(8)}px);
    pointer-events: none;
  }

  .mark {
    position: relative;
    z-index: 2;
    filter:
      drop-shadow(0 0 ${px(8)}px rgba(255,255,255,0.95))
      drop-shadow(0 0 ${px(28)}px rgba(180,220,255,0.9))
      drop-shadow(0 0 ${px(70)}px rgba(56,189,248,0.75))
      drop-shadow(0 0 ${px(140)}px rgba(56,189,248,0.45));
  }

  .copy {
    position: relative;
    z-index: 2;
    margin-top: ${px(220)}px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${px(28)}px;
    padding: 0 ${px(200)}px;
  }

  .headline {
    font-weight: 700;
    font-size: ${px(118)}px;
    line-height: 1.08;
    letter-spacing: -0.045em;
    text-shadow: 0 0 ${px(50)}px rgba(120,190,255,0.25);
  }

  .kicker {
    margin-top: ${px(18)}px;
    font-weight: 500;
    font-size: ${px(40)}px;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: rgba(244,246,255,0.78);
  }

  .meta {
    margin-top: ${px(6)}px;
    font-weight: 500;
    font-size: ${px(28)}px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(170,190,220,0.72);
    line-height: 1.7;
  }
  .meta strong {
    font-weight: 500;
    color: rgba(200,220,245,0.88);
  }

  /* Platform */
  .platform {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: ${px(1350)}px;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .ground-glow {
    position: absolute;
    bottom: ${px(260)}px;
    width: ${px(1800)}px;
    height: ${px(420)}px;
    background: radial-gradient(ellipse at center, rgba(120,190,255,0.45), rgba(56,189,248,0.18) 40%, transparent 72%);
    filter: blur(${px(24)}px);
  }
  .slab {
    position: relative;
    width: ${px(1280)}px;
    height: ${px(340)}px;
    margin-bottom: ${px(280)}px;
    transform: perspective(${px(1200)}px) rotateX(58deg);
    border-radius: ${px(56)}px;
    background:
      linear-gradient(180deg, #1a2338 0%, #0b101c 55%, #060910 100%);
    box-shadow:
      0 -${px(2)}px 0 rgba(220,235,255,0.35),
      0 0 0 ${px(2)}px rgba(90,170,255,0.35),
      0 0 ${px(60)}px rgba(80,170,255,0.35),
      0 ${px(40)}px ${px(100)}px rgba(0,0,0,0.65),
      inset 0 ${px(18)}px ${px(40)}px rgba(120,180,255,0.12),
      inset 0 -${px(30)}px ${px(50)}px rgba(0,0,0,0.55);
  }
  .slab::after {
    content: '';
    position: absolute;
    inset: ${px(22)}px;
    border-radius: ${px(40)}px;
    background:
      linear-gradient(180deg, rgba(100,170,255,0.10), transparent 45%),
      repeating-linear-gradient(90deg, transparent 0 ${px(22)}px, rgba(80,160,255,0.04) ${px(22)}px ${px(23)}px);
    box-shadow: inset 0 0 0 1px rgba(120,180,255,0.12);
  }
  .url {
    position: absolute;
    bottom: ${px(140)}px;
    left: 0;
    right: 0;
    z-index: 3;
    font-weight: 500;
    font-size: ${px(34)}px;
    letter-spacing: 0.22em;
    text-transform: lowercase;
    color: rgba(140,190,255,0.85);
  }
</style></head>
<body>
  <div class="stage">
    <div class="beam"></div>
    <div class="beam-core"></div>

    <div class="top">
      <div class="halo"></div>
      <div class="mark">${markSvg(px(300))}</div>
    </div>

    <div class="copy">
      <div class="headline">Break real systems.<br/>Fix them live.</div>
      <div class="kicker">100-Seat Pilot</div>
      <div class="meta">
        <strong>Live Linux · Docker · Kubernetes</strong><br/>
        Real terminals in your browser · Graded instantly<br/>
        Build Raft, KV stores &amp; query engines · No AWS
      </div>
    </div>

    <div class="platform">
      <div class="ground-glow"></div>
      <div class="slab"></div>
      <div class="url">devsetu.io</div>
    </div>
  </div>
</body></html>`;

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const name = 'poster-nitw-soft-launch-a4.png';
const htmlPath = join(TMP, `${name}.html`);
writeFileSync(htmlPath, html);

execFileSync(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--default-background-color=00000000',
  '--virtual-time-budget=12000',
  `--window-size=${W},${H}`,
  `--screenshot=${join(OUT, name)}`,
  `file://${htmlPath}`,
], { stdio: 'inherit' });

execFileSync('sips', ['-s', 'dpiWidth', '300', '-s', 'dpiHeight', '300', join(OUT, name)], {
  stdio: 'ignore',
});

const cursorAssets = join(
  homedir(),
  '.cursor/projects/Users-rithvik-Documents-devlabs-ai-devlabs/assets',
);
mkdirSync(cursorAssets, { recursive: true });
copyFileSync(join(OUT, name), join(cursorAssets, name));

console.log(`✓ ${name} (${W}×${H} · A4 @ 300 DPI)`);
