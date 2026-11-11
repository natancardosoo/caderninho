import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupPluggy } from './pluggy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}
const PORT = Number(process.env.PORT || 4320);
const DIST = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'data');
const STATE = path.join(DATA_DIR, 'state.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const readState = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : null);
const writeState = (next, cur) => {
  next._rev = (cur?._rev || 0) + 1;
  if (cur) fs.copyFileSync(STATE, STATE + '.bak');
  fs.writeFileSync(STATE + '.tmp', JSON.stringify(next));
  fs.renameSync(STATE + '.tmp', STATE);
  return next._rev;
};
// alteração feita pelo servidor (sincronização com o banco): lê, aplica e grava de uma vez (síncrono)
const mutateState = (fn) => {
  const cur = readState();
  if (!cur) throw new Error('Estado do app ainda não existe');
  const next = structuredClone(cur);
  fn(next);
  return writeState(next, cur);
};
const log = (m) => console.log(`[${new Date().toLocaleString('pt-BR')}] ${m}`);
const pluggy = setupPluggy({ dataDir: DATA_DIR, readState, mutateState, log });

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/pluggy/')) return pluggy.handle(req, res, url);
  if (url.pathname === '/api/state') {
    if (req.method === 'GET') {
      if (!fs.existsSync(STATE)) return send(res, 200, 'null');
      return send(res, 200, fs.readFileSync(STATE));
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 20e6) req.destroy(); });
      req.on('end', () => {
        try {
          const next = JSON.parse(body);
          const cur = readState();
          // gravação baseada numa versão antiga (outro aparelho/aba/sincronização salvou antes): recusa e devolve a atual
          if (cur && next._rev !== (cur._rev || 0)) return send(res, 409, JSON.stringify(cur));
          send(res, 200, JSON.stringify({ ok: true, rev: writeState(next, cur) }));
        } catch { send(res, 400, '{"ok":false}'); }
      });
      return;
    }
    return send(res, 405, '{}');
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) return send(res, 403, 'forbidden', 'text/plain');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => console.log(`Finanças rodando em http://127.0.0.1:${PORT}`));
