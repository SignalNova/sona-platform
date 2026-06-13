import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = true;
const app = next({ dev, port, turbopack: true });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  
  server.listen(port, () => {
    console.log(`> Sona App running on http://localhost:${port}`);
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
}).catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
