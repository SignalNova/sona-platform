const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function startServer() {
  const server = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: '/home/z/my-project',
    detached: true,
    stdio: 'ignore'
  });
  server.unref();
  return server.pid;
}

function startBore() {
  const bore = spawn('/home/z/my-project/bore', ['local', '3000', '--to', 'bore.pub'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let output = '';
  bore.stdout.on('data', (data) => {
    output += data.toString();
    const match = output.match(/remote_port=(\d+)/);
    if (match) {
      const port = match[1];
      const url = `http://bore.pub:${port}`;
      fs.writeFileSync('/home/z/my-project/current-tunnel-url.txt', url);
      fs.writeFileSync('/home/z/my-project/current-tunnel-port.txt', port);
      console.log('TUNNEL_URL=' + url);
    }
  });
  
  bore.stderr.on('data', (data) => {
    output += data.toString();
    const match = output.match(/remote_port=(\d+)/);
    if (match) {
      const port = match[1];
      const url = `http://bore.pub:${port}`;
      fs.writeFileSync('/home/z/my-project/current-tunnel-url.txt', url);
      fs.writeFileSync('/home/z/my-project/current-tunnel-port.txt', port);
      console.log('TUNNEL_URL=' + url);
    }
  });
  
  bore.unref();
  return bore.pid;
}

// Start both
const serverPid = startServer();
console.log('Server PID:', serverPid);

setTimeout(() => {
  const borePid = startBore();
  console.log('Bore PID:', borePid);
}, 3000);

// Keep this process alive
setInterval(() => {
  const url = fs.readFileSync('/home/z/my-project/current-tunnel-url.txt', 'utf8').trim();
  console.log('Keep-alive tick. URL:', url);
}, 60000);
