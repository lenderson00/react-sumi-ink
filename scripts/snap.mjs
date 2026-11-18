import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const ART = '/opt/cursor/artifacts';
await mkdir(ART, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:4178/#/playground', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
for (let i = 0; i < 10; i++) {
  await page.mouse.move(280 + i * 45, 220 + Math.sin(i) * 30);
  await page.mouse.down();
  await page.mouse.move(520 + i * 35, 420, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(180);
}
await page.screenshot({ path: `${ART}/demo-frame.png` });
await browser.close();
console.log('snap ok');