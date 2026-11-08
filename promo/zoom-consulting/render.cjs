// 썸네일 PNG 만들기: node promo/zoom-consulting/render.cjs
// 결과: thumb_wide.png (정확히 1200×630px), thumb_square.png (2160×2160px, 1080×1080 @2x)
const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = __dirname;
const page_url = pathToFileURL(path.join(dir, "thumbnail.html")).href;
const sizes = [
  { layout: "wide", width: 1200, height: 630, scale: 1 },
  { layout: "square", width: 1080, height: 1080, scale: 2 },
];

(async () => {
const browser = await chromium.launch();
for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale });
  await page.goto(`${page_url}?layout=${s.layout}`);
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(dir, `thumb_${s.layout}.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: s.width, height: s.height } });
  console.log("saved", out);
  await page.close();
}
await browser.close();
})();
