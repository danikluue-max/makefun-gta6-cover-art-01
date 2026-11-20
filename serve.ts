// A tiny static server for app/ (Node 22, standard library only), so the
// cover maker can be tried locally without a build step:
//   node serve.ts [--port 8080]
// serves app/ on http://localhost:8080. It sends the MIME types an
// offline web app needs, refuses any path outside app/, and otherwise
// does nothing clever: this is a development convenience, not a web
// server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./app', import.meta.url)));

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.bin', 'application/octet-stream'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function pickPort(argv) {
  const at = argv.indexOf('--port');
  const value = at === -1 ? 8080 : Number(argv[at + 1]);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : 8080;
}

function mimeFor(file) {
  return MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
}

/** Resolves a request path to a file under app/, or null when it escapes. */
function resolveInside(pathname) {
  let cleaned = pathname;
  if (cleaned.endsWith('/')) cleaned += 'index.html';
  const file = resolve(join(root, normalize(cleaned)));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return file;
}

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  const file = resolveInside(pathname);
  if (!file) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mimeFor(file),
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
});

const port = pickPort(process.argv.slice(2));
server.listen(port, '127.0.0.1', () => {
  console.log(`app/ is on http://localhost:${port}`);
});
