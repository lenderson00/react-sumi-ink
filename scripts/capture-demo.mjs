import { mkdir, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ART = '/opt/cursor/artifacts';
const ROOT = new URL('..', import.meta.url).pathname;

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} ${c}`))));
  });
}

async function main() {
  await mkdir(ART, { recursive: true });
  await mkdir(`${ROOT}/docs/assets`, { recursive: true });

  const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4178'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  await sleep(2500);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:4178/#/playground', { waitUntil: 'networkidle' });
  await sleep(1500);

  for (let i = 0; i < 8; i++) {
    await page.mouse.move(200 + i * 80, 180 + Math.sin(i) * 40);
    await page.mouse.down();
    await page.mouse.move(400 + i * 60, 420 + i * 10, { steps: 8 });
    await page.mouse.up();
    await sleep(200);
  }
  await page.screenshot({ path: `${ART}/demo-frame.png`, fullPage: false });
  await browser.close();

  await run('ffmpeg', [
    '-y',
    '-loop',
    '1',
    '-i',
    `${ART}/demo-frame.png`,
    '-vf',
    'fps=12,scale=960:-1',
    '-t',
    '3',
    '-pix_fmt',
    'yuv420p',
    `${ROOT}/docs/assets/demo.gif`,
  ]);

  await run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=faf8f4:s=1920x1080:d=20',
    '-vf',
    `movie=${ART}/demo-frame.png:loop=0,setpts=N/(12*TB),scale=1600:-1,format=rgba,colorchannelmixer=aa=0.95[ov];[in][ov]overlay=(W-w)/2:(H-h)/2,format=yuv420p`,
    '-t',
    '20',
    '-c:v',
    'libx264',
    `${ART}/launch-demo.mp4`,
  ]);

  await run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=faf8f4:s=1080x1920:d=12',
    '-vf',
    `movie=${ART}/demo-frame.png:loop=0,setpts=N/(12*TB),scale=900:-1,format=rgba,colorchannelmixer=aa=0.95[ov];[in][ov]overlay=(W-w)/2:(H-h)/2,format=yuv420p`,
    '-t',
    '12',
    '-c:v',
    'libx264',
    `${ART}/launch-demo-mobile.mp4`,
  ]);

  await copyFile(`${ROOT}/docs/assets/demo.gif`, `${ART}/demo.gif`);
  server.kill('SIGTERM');
  console.log('artifacts ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});