const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const app = next({ dev: true, port: 3000, turbopack: true });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  
  server.listen(3000, '0.0.0.0', () => {
    console.log('SONA running on http://localhost:3000');
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
  
  process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
  });
  
  // Keep alive
  setInterval(() => {}, 60000);
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
