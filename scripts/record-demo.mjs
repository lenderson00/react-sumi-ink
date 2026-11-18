import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer as createVite } from 'vite';

const OUT = '/opt/cursor/artifacts';
const PORT = 5198;

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await createVite({
    root: new URL('..', import.meta.url).pathname,
    server: { port: PORT, strictPort: true },
  });
  await server.listen();
  const url = `http://127.0.0.1:${PORT}/#/playground`;
  const desktop = `${OUT}/launch-demo.mp4`;
  const mobile = `${OUT}/launch-demo-mobile.mp4`;

  await record(url, desktop, 1920, 1080, 20);
  await record(`${url}`, mobile, 1080, 1920, 12);

  await server.close();
  console.log('Saved', desktop, mobile);
}

function record(pageUrl, outFile, w, h, seconds) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-f',
      'x11grab',
      '-video_size',
      `${w}x${h}`,
      '-i',
      ':99',
      '-t',
      String(seconds),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      outFile,
    ];
    const ff = spawn('ffmpeg', args, { stdio: 'inherit' });
    ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
    spawn('chromium', [`--window-size=${w},${h}`, pageUrl], { env: process.env, detached: true });
    setTimeout(() => {}, 1000);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});