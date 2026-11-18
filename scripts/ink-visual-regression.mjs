import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.INK_TEST_URL || 'http://127.0.0.1:4178/#/';

const TARGET = {
  dark: 0.159,
  mid: 0.196,
  paper: 0.645,
  edge: 0.056,
  hf: 8.73,
};

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2200);
  const png = await page.screenshot({
    path: '/opt/cursor/artifacts/visual-regression-home.png',
    timeout: 60000,
    animations: 'disabled',
  });
  await browser.close();

  const stats = await analyze(png);
  const darkOk = stats.dark > TARGET.dark * 0.45 && stats.dark < TARGET.dark * 2.4;
  const midOk = stats.mid > TARGET.mid * 0.4 && stats.mid < TARGET.mid * 2.4;
  const paperOk = stats.paper > 0.32 && stats.paper < 0.9;
  const edgeOk = stats.edge > TARGET.edge * 0.28;
  const hfOk = stats.hf > TARGET.hf * 0.32;
  console.log(JSON.stringify({ ok: darkOk && midOk && paperOk && edgeOk && hfOk, target: TARGET, ...stats }));
  assert.ok(darkOk, `dark coverage off target: ${JSON.stringify(stats)}`);
  assert.ok(midOk, `wash coverage off target: ${JSON.stringify(stats)}`);
  assert.ok(paperOk, `paper coverage off target: ${JSON.stringify(stats)}`);
  assert.ok(edgeOk, `edges too soft vs target: ${JSON.stringify(stats)}`);
  assert.ok(hfOk, `high frequency detail low vs target: ${JSON.stringify(stats)}`);
}

async function analyze(png) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = `data:image/png;base64,${png.toString('base64')}`;
  const stats = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const n = width * height;
    let dark = 0;
    let mid = 0;
    let paper = 0;
    let edges = 0;
    let hf = 0;
    const lumAt = (x, y) => {
      const o = (y * width + x) * 4;
      return data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lum = lumAt(x, y);
        if (lum < 70) dark++;
        else if (lum < 175) mid++;
        else paper++;
        if (x + 1 < width) {
          const d = Math.abs(lum - lumAt(x + 1, y));
          hf += d;
          if (d > 28) edges++;
        }
      }
    }
    return { dark: dark / n, mid: mid / n, paper: paper / n, edge: edges / n, hf: hf / n, width, height };
  }, url);
  await browser.close();
  return stats;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
