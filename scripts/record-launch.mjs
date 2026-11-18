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
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  });

  const record = async (viewport, file, fn) => {
    const ctx = await browser.newContext({
      viewport,
      recordVideo: { dir: ART, size: viewport },
    });
    const page = await ctx.newPage();
    const base = process.env.INK_DEMO_URL || 'http://127.0.0.1:4178';
    await page.goto(`${base}/?ink-main=1#/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__inkReplay, null, { timeout: 20000 });
    await fn(page);
    await page.waitForTimeout(500);
    const vpath = await page.video()?.path();
    await ctx.close();
    if (vpath) await run('ffmpeg', ['-y', '-i', vpath, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', file]);
  };

  await record({ width: 1920, height: 1080 }, `${ART}/launch-demo.mp4`, async (page) => {
    await page.evaluate(() => {
      window.__inkClear();
      window.__inkReplay(true);
    });
    await page.waitForTimeout(6000);
    const box = await page.locator('.studio-stage').boundingBox();
    if (box) {
      await page.mouse.move(box.x + 160, box.y + 280);
      await page.mouse.down();
      await page.mouse.move(box.x + 420, box.y + 520, { steps: 18 });
      await page.mouse.up();
    }
    await page.waitForTimeout(8000);
  });

  await record({ width: 1080, height: 1920 }, `${ART}/launch-demo-mobile.mp4`, async (page) => {
    await page.evaluate(() => {
      window.__inkClear();
      window.__inkReplay(true);
    });
    await page.waitForTimeout(3500);
    const box = await page.locator('.studio-stage').boundingBox();
    if (box) {
      await page.mouse.move(box.x + 80, box.y + 700);
      await page.mouse.down();
      await page.mouse.move(box.x + 240, box.y + 980, { steps: 12 });
      await page.mouse.up();
    }
    await page.waitForTimeout(4500);
  });

  await browser.close();

  await contactSheet(`${ART}/launch-demo.mp4`, `${ART}/launch-demo-contact.jpg`);
  await contactSheet(`${ART}/launch-demo-mobile.mp4`, `${ART}/launch-demo-mobile-contact.jpg`);

  await run('ffmpeg', [
    '-y',
    '-i',
    `${ART}/launch-demo.mp4`,
    '-t',
    '8',
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