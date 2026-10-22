#!/usr/bin/env node
// Deterministic HTML → MP4 renderer (same pattern as mg-styles-15's harness):
// index.html exposes window.DEMO, window.renderAt(t) and window.CUES; we seek every frame and pipe screenshots to ffmpeg.
//
//   node render.mjs                       # full render → out/video.mp4 (needs out/audio.wav from audio.py)
//   node render.mjs --stills 0.4,5,9.5    # PNG stills → out/stills/
//   node render.mjs --cues                # write cues.json for audio.py
//   options: --workers 4 --scale 0.5 --from 0 --to 10
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright'))); }

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null).filter(Boolean));
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, url, scale) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  return page;
}

const ff = (a) => new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['pipe', 'inherit', 'inherit'] });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  return p;
});

const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/index.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none'] });
const scale = +(args.scale || 1);
fs.mkdirSync(OUT, { recursive: true });

try {
  const page = await openPage(browser, url, scale);
  const demo = await page.evaluate(() => window.DEMO);

  if (args.cues) {
    fs.writeFileSync(path.join(ROOT, 'cues.json'), JSON.stringify(await page.evaluate(() => window.CUES), null, 1));
    console.log('wrote cues.json');
  } else if (args.stills) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const t of String(args.stills).split(',').map(Number)) {
      await page.evaluate((t) => window.renderAt(t), t);
      await page.screenshot({ path: path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`) });
    }
    console.log('stills →', dir);
  } else {
    const fps = demo.fps, from = +(args.from || 0), to = +(args.to || demo.duration);
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
    const W = Math.max(1, +(args.workers || 4));
    const per = Math.ceil((f1 - f0) / W);
    const parts = [];
    await page.close();
    const t0 = Date.now();
    await Promise.all(Array.from({ length: W }, async (_, w) => {
      const a = f0 + w * per, b = Math.min(f1, a + per);
      if (a >= b) return;
      const part = path.join(OUT, `part${w}.mp4`); parts[w] = part;
      const pg = await openPage(browser, url, scale);
      const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', part], { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
      for (let f = a; f < b; f++) {
        await pg.evaluate((t) => window.renderAt(t), f / fps);
        const buf = await pg.screenshot({ type: 'jpeg', quality: 94 });
        if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
        if (w === 0 && (f - a) % 60 === 0) console.log(`frame ${f - a}/${b - a} (worker 0) ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      p.stdin.end(); await done; await pg.close();
    }));
    const list = path.join(OUT, 'parts.txt');
    fs.writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
    const audio = path.join(OUT, 'audio.wav');
    const final = args.out || path.join(OUT, 'video.mp4');
    const aArgs = fs.existsSync(audio) && !args.noaudio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : [];
    await ff(['-f', 'concat', '-safe', '0', '-i', list, ...aArgs, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-t', String(to - from), final]);
    parts.filter(Boolean).forEach((p) => fs.rmSync(p)); fs.rmSync(list);
    console.log(`video → ${final} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
} finally {
  await browser.close(); srv.close();
}
