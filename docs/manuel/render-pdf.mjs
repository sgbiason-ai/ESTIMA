// docs/manuel/render-pdf.mjs
// Rend manuel-complet.html → PDF paginé via Chrome (DevTools Protocol, sans dépendance).
// Ajoute les numéros de page (footerTemplate) ; le sommaire cliquable vient des ancres HTML.
// Usage : node docs/manuel/render-pdf.mjs

import { spawn } from 'child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const CHROME = CHROME_CANDIDATES.find(existsSync);
if (!CHROME) throw new Error('Chrome/Edge introuvable');

const htmlPath = join(__dirname, 'manuel-complet.html');
const outPath = join(__dirname, 'EstimaVRD-Manuel-Complet.pdf');
const fileUrl = pathToFileURL(htmlPath).href;
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const footer = `<div style="font-size:8px;width:100%;padding:0 15mm;color:#9ca3af;font-family:-apple-system,'Segoe UI',sans-serif;display:flex;justify-content:space-between;">
  <span>EstimaVRD — Manuel d'utilisation</span>
  <span>v3.3.1 &nbsp;·&nbsp; <span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

const userDir = mkdtempSync(join(tmpdir(), 'estima-pdf-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank',
], { stdio: 'ignore' });

async function waitEndpoint() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Endpoint de debug Chrome indisponible');
}

async function getPageWs() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json`);
  const list = await r.json();
  const t = list.find((x) => x.type === 'page') || list[0];
  return t.webSocketDebuggerUrl;
}

try {
  await waitEndpoint();
  const wsUrl = await getPageWs();
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  let loaded = false;
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    if (msg.method === 'Page.loadEventFired') loaded = true;
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = nextId++; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  loaded = false;
  await send('Page.navigate', { url: fileUrl });
  for (let i = 0; i < 100 && !loaded; i++) await sleep(100);
  await sleep(500); // laisser le layout + SVG se poser

  const { stream } = await send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: footer,
    transferMode: 'ReturnAsStream',
  });

  const chunks = [];
  for (;;) {
    const r = await send('IO.read', { handle: stream, size: 1 << 20 });
    if (r.data) chunks.push(Buffer.from(r.data, r.base64Encoded ? 'base64' : 'utf8'));
    if (r.eof) break;
  }
  await send('IO.close', { handle: stream });
  const pdf = Buffer.concat(chunks);
  writeFileSync(outPath, pdf);
  console.log(`✓ PDF paginé (${(pdf.length / 1024).toFixed(0)} Ko) → ${outPath}`);
  ws.close();
} finally {
  chrome.kill();
}
