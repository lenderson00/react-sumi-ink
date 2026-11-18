import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

const ART = '/opt/cursor/artifacts';
const ROOT = path.dirname(new URL(import.meta.url).pathname);

async function contactSheet(video, out, cols = 3, rows = 3) {
  await run('ffmpeg', [
    '-y',
    '-i',
    video,
    '-vf',
    `select='not(mod(n\\,${Math.max(1, Math.floor(20 / (cols * rows)))}))',scale=640:-1,tile=${cols}x${rows}`,
    '-frames:v',
    '1',
    '-update',
    '1',
    out,
  ]);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} ${c}`))));
  });
}

async function main() {
  await mkdir(ART, { recursive: true });
  await mkdir(path.join(ROOT, '../docs/assets'), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const record = async (viewport, file, fn) => {
    const ctx = await browser.newContext({
      viewport,
      recordVideo: { dir: ART, size: viewport },
    });
    const page = await ctx.newPage();
    const base = process.env.INK_DEMO_URL || 'http://127.0.0.1:4178';
    await page.goto(`${base}/#/playground`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await fn(page);
    await page.waitForTimeout(500);
    const vpath = await page.video()?.path();
    await ctx.close();
    if (vpath) await run('ffmpeg', ['-y', '-i', vpath, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', file]);
  };

  await record({ width: 1920, height: 1080 }, `${ART}/launch-demo.mp4`, async (page) => {
    const box = await page.locator('.stage').boundingBox();
    if (!box) return;
    for (let i = 0; i < 40; i++) {
      const x = box.x + 180 + i * 36;
      const y = box.y + 220 + Math.sin(i * 0.35) * 80;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 40, y + 28, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(120);
    }
    await page.locator('.scene-ink-btn').click();
    await page.waitForTimeout(600);
    await page.selectOption('.cp-select', 'koi');
    await page.waitForTimeout(800);
    await page.mouse.move(box.x + 400, box.y + 350);
    await page.mouse.down();
    await page.mouse.move(box.x + 700, box.y + 420, { steps: 16 });
    await page.mouse.up();
    await page.waitForTimeout(1000);
    await page.selectOption('.cp-select', 'smoke');
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await page.waitForTimeout(2000);
    await page.goto('http://127.0.0.1:5198/#/');
    await page.waitForTimeout(2500);
    await page.goto('http://127.0.0.1:5198/#/playground');
    await page.waitForTimeout(3000);
  });

  await record({ width: 1080, height: 1920 }, `${ART}/launch-demo-mobile.mp4`, async (page) => {
    const box = await page.locator('.stage').boundingBox();
    if (!box) return;
    for (let i = 0; i < 18; i++) {
      const x = box.x + 80 + i * 30;
      const y = box.y + 280 + i * 22;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 20, y + 35, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
    await page.locator('.scene-ink-btn').click();
    await page.waitForTimeout(400);
    await page.selectOption('.cp-select', 'sumi');
    await page.waitForTimeout(2500);
  });

  await browser.close();

  await contactSheet(`${ART}/launch-demo.mp4`, `${ART}/launch-demo-contact.jpg`);
  await contactSheet(`${ART}/launch-demo-mobile.mp4`, `${ART}/launch-demo-mobile-contact.jpg`);

  await run('ffmpeg', [
    '-y',
    '-i',
    `${ART}/launch-demo.mp4`,
    '-vf',
    'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
    '-loop',
    '0',
    path.join(ROOT, '../docs/assets/demo.gif'),
  ]);
  await run('cp', [path.join(ROOT, '../docs/assets/demo.gif'), `${ART}/demo.gif`]);

  console.log('recorded', ART);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});