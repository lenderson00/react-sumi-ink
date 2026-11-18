import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.INK_TEST_URL || 'http://127.0.0.1:5198/#/playground';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const stage = page.locator('.stage');
  const box = await stage.boundingBox();
  if (!box) throw new Error('no stage');
  for (let i = 0; i < 24; i++) {
    const x = box.x + 220 + i * 28;
    const y = box.y + 280 + Math.sin(i * 0.45) * 48;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 36, y + 18, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(2800);

  const stats = await page.evaluate(async () => {
    const canvas = document.querySelector('.stage canvas.ink-stage-layer');
    if (!canvas) return { error: 'no canvas' };
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) return { error: 'no gl' };
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let inkish = 0;
    let paperish = 0;
    let dark = 0;
    const n = w * h;
    for (let i = 0; i < n; i += 1) {
      const o = i * 4;
      const r = pixels[o];
      const g = pixels[o + 1];
      const b = pixels[o + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (lum < 120) inkish++;
      if (lum > 180 && lum < 245) paperish++;
      dark += 255 - lum;
    }
    return { inkish: inkish / n, paperish: paperish / n, darkAvg: dark / n };
  });

  await page.screenshot({ path: '/opt/cursor/artifacts/visual-regression-playground.png' });
  await browser.close();

  assert.equal(stats.error, undefined, stats.error);
  assert.ok(stats.inkish > 0.003, `ink coverage low: ${JSON.stringify(stats)}`);
  assert.ok(stats.paperish > 0.2, `paper coverage low: ${JSON.stringify(stats)}`);
  console.log(JSON.stringify({ ok: true, ...stats }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});