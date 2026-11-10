import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['style.css', 'text/css; charset=utf-8'],
  ['mark.svg', 'image/svg+xml'],
  ...['app.js', 'data.js', 'chart.js', 'market.js'].map(name => [name, 'text/javascript; charset=utf-8'])
]);
const port = Number(process.env.MARKET_OBSERVER_PORT ?? 4173);
const root = new URL(process.argv.includes('--dist') ? './dist/' : './', import.meta.url);

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!files.has(name)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const contents = await readFile(new URL(name, root));
    response.writeHead(200, { 'Content-Type': files.get(name), 'Cache-Control': 'no-store' }).end(contents);
  } catch {
    response.writeHead(500).end('Unable to read asset');
  }
}).listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));

