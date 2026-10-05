import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const FONT_DIR = "/workspace/.grok/fonts";
const OUT_DIR = "/workspace/.grok";

function b64(name) {
  return readFileSync(`${FONT_DIR}/${name}`).toString("base64");
}

const FONT_CSS = `
@font-face {
  font-family: "Cormorant Cover";
  font-style: italic;
  font-weight: 500;
  src: url(data:font/ttf;base64,${b64("corm-0.ttf")}) format("truetype");
}
@font-face {
  font-family: "Cormorant Cover";
  font-style: normal;
  font-weight: 500;
  src: url(data:font/ttf;base64,${b64("corm-1.ttf")}) format("truetype");
}
@font-face {
  font-family: "Cormorant Cover";
  font-style: normal;
  font-weight: 600;
  src: url(data:font/ttf;base64,${b64("corm-2.ttf")}) format("truetype");
}
@font-face {
  font-family: "Cormorant Cover";
  font-style: normal;
  font-weight: 700;
  src: url(data:font/ttf;base64,${b64("corm-3.ttf")}) format("truetype");
}
`;

function stars(n, w, h, seed) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = rnd() < 0.08 ? rnd() * 1.6 + 0.9 : rnd() * 0.9 + 0.25;
    const rust = rnd() < 0.2;
    const o = rnd() * 0.55 + 0.2;
    const c = rust ? "#7c3a2a" : rnd() < 0.45 ? "#e8e2d6" : "#c8c4bb";
    parts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" opacity="${o.toFixed(2)}"/>`,
    );
  }
  return parts.join("");
}

const SHIP = `
<svg class="ship" viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <filter id="eglow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <ellipse cx="38" cy="108" rx="32" ry="11" fill="#7c3a2a" opacity="0.5" filter="url(#eglow)"/>
  <path d="M48 102 C70 86, 140 78, 230 76 C310 74, 400 80, 490 102 L500 108 C400 126, 310 132, 230 132 C140 132, 70 124, 42 110 Z" fill="#161412" stroke="#c8c4bb" stroke-width="1.15"/>
  <path d="M70 100 C140 88, 230 86, 400 98" fill="none" stroke="#9a9286" stroke-width="0.65" opacity="0.75"/>
  <path d="M210 78 L210 38 L248 10 L286 38 L286 78 Z" fill="#12110f" stroke="#c8c4bb" stroke-width="1.05"/>
  <circle cx="248" cy="48" r="8" fill="none" stroke="#7c3a2a" stroke-width="1.2"/>
  <circle cx="248" cy="48" r="2.6" fill="#7c3a2a"/>
  <path d="M240 16 L248 0 L256 16 Z" fill="#e8e2d6"/>
  <path d="M188 78 L196 42 L204 78 Z" fill="#1a1816" stroke="#c8c4bb" stroke-width="0.85"/>
  <path d="M292 78 L300 44 L308 78 Z" fill="#1a1816" stroke="#c8c4bb" stroke-width="0.85"/>
  <rect x="194" y="34" width="4" height="8" fill="#e8e2d6"/>
  <rect x="298" y="36" width="4" height="8" fill="#e8e2d6"/>
  <path d="M210 50 L160 78" stroke="#9a9286" stroke-width="1.15"/>
  <path d="M286 50 L336 78" stroke="#9a9286" stroke-width="1.15"/>
  <path d="M210 62 L170 78" stroke="#9a9286" stroke-width="0.8" opacity="0.7"/>
  <path d="M286 62 L326 78" stroke="#9a9286" stroke-width="0.8" opacity="0.7"/>
  <rect x="226" y="56" width="4" height="12" fill="#7c3a2a"/>
  <rect x="236" y="56" width="4" height="12" fill="#7c3a2a"/>
  <rect x="256" y="56" width="4" height="12" fill="#7c3a2a"/>
  <rect x="266" y="56" width="4" height="12" fill="#7c3a2a"/>
  <path d="M490 102 L518 106 L490 110 Z" fill="#c8c4bb"/>
  <path d="M118 128 L108 148 L128 148 L138 128 Z" fill="#161412" stroke="#9a9286" stroke-width="0.6"/>
  <path d="M372 128 L362 128 L376 148 L394 148 Z" fill="#161412" stroke="#9a9286" stroke-width="0.6"/>
  <rect x="28" y="100" width="18" height="10" rx="2" fill="#7c3a2a"/>
  <rect x="20" y="103" width="12" height="6" rx="2" fill="#9a3a28"/>
</svg>
`;

function cardHtml({ w, h, kind }) {
  const isOg = kind === "og";
  const starSvg = stars(isOg ? 70 : 48, w, h, isOg ? 42 : 91);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<style>
${FONT_CSS}
html, body { margin: 0; padding: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: #0c0b0a; }
.stage {
  position: relative;
  width: ${w}px;
  height: ${h}px;
  background:
    radial-gradient(ellipse 55% 36% at ${isOg ? "68% 74%" : "78% 58%"}, rgba(124,58,42,0.16), transparent 72%),
    radial-gradient(ellipse 42% 48% at 50% 46%, rgba(22,20,18,0.55), transparent 70%),
    #0c0b0a;
}
.stars { position: absolute; inset: 0; }
.vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 78% 70% at 50% 48%, transparent 40%, #0c0b0a 100%);
  pointer-events: none;
}
.grain {
  position: absolute; inset: 0; opacity: 0.05; pointer-events: none; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.lockup {
  position: absolute;
  ${
    isOg
      ? "left: 50%; top: 46%; transform: translate(-50%, -50%); text-align: center; width: 820px;"
      : "left: 48px; top: 28px; text-align: left; width: 520px;"
  }
}
.title {
  margin: 0;
  color: #e8e2d6;
  font-family: "Cormorant Cover", "Liberation Serif", serif;
  font-weight: 700;
  font-size: ${isOg ? "210px" : "72px"};
  line-height: 0.9;
  letter-spacing: ${isOg ? "0.22em" : "0.18em"};
  text-indent: ${isOg ? "0.22em" : "0.18em"};
  font-kerning: none;
  text-shadow: 0 2px 18px rgba(12,11,10,0.85);
}
.rule {
  ${isOg ? "margin: 18px auto 16px;" : "margin: 10px 0 8px;"}
  width: ${isOg ? "220px" : "92px"};
  height: 1px;
  background: linear-gradient(90deg, transparent, #7c3a2a 18%, #7c3a2a 82%, transparent);
}
.sub {
  margin: 0;
  color: #9a9286;
  font-family: "Cormorant Cover", "Liberation Serif", serif;
  font-style: italic;
  font-weight: 500;
  font-size: ${isOg ? "42px" : "22px"};
  line-height: 1;
  letter-spacing: ${isOg ? "0.42em" : "0.34em"};
  text-indent: ${isOg ? "0.42em" : "0.34em"};
}
.ship-wrap {
  position: absolute;
  ${
    isOg
      ? "left: 50%; bottom: 54px; transform: translateX(-50%); width: 268px;"
      : "left: 620px; top: 46px; width: 330px;"
  }
}
.ship { display: block; width: 100%; height: auto; overflow: visible; }
</style>
</head>
<body>
  <div class="stage">
    <svg class="stars" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${starSvg}</svg>
    <div class="lockup">
      <p class="title">Смех</p>
      <div class="rule"></div>
      <p class="sub">в пустоте</p>
    </div>
    <div class="ship-wrap">${SHIP}</div>
    <div class="vignette"></div>
    <div class="grain"></div>
  </div>
</body>
</html>`;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/og-card.html`, cardHtml({ w: 1200, h: 630, kind: "og" }));
writeFileSync(`${OUT_DIR}/banner-card.html`, cardHtml({ w: 1200, h: 264, kind: "banner" }));

const browser = await chromium.launch({ args: ["--disable-web-security"] });

async function shot(file, w, h, outPng) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
  });
  await page.goto(`file://${file}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
  const lockup = await page.locator(".lockup").boundingBox();
  const ship = await page.locator(".ship-wrap").boundingBox();
  await page.screenshot({ path: outPng, type: "png", animations: "disabled" });
  await page.close();
  return { lockup, ship };
}

const ogBoxes = await shot(`${OUT_DIR}/og-card.html`, 1200, 630, `${OUT_DIR}/og-raw.png`);
const bnBoxes = await shot(`${OUT_DIR}/banner-card.html`, 1200, 264, `${OUT_DIR}/banner-raw.png`);
await browser.close();

writeFileSync(
  `${OUT_DIR}/brand-boxes.json`,
  JSON.stringify({ og: ogBoxes, banner: bnBoxes }, null, 2),
);
console.log(JSON.stringify({ og: ogBoxes, banner: bnBoxes }, null, 2));
