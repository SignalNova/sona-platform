/**
 * SONA Email Relay - Watchdog Process v2
 * 
 * Runs continuously, checks tunnel URL every 5 minutes.
 * Auto-updates GitHub Gist when URL changes.
 * Uses simpler process checks (no pm2 jlist).
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');

const RELAY_DIR = '/home/z/my-project/email-relay';
const URL_FILE = `${RELAY_DIR}/current-tunnel-url.txt`;
const GIST_ID = 'c4c89af78e5f073912160edcea45a61b';
const GITHUB_TOKEN = process.env.GIST_GITHUB_TOKEN || "";
const RELAY_KEY = process.env.RELAY_API_KEY || 'sk-sona-relay-2024-secure';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [WATCHDOG] ${msg}`);
  try { fs.appendFileSync(`${RELAY_DIR}/watchdog.log`, `${ts} ${msg}\n`); } catch {}
}

function getTunnelUrl() {
  try {
    const logs = fs.readFileSync('/home/z/.pm2/logs/cloudflared-tunnel-error.log', 'utf8');
    const matches = logs.match(/https:\/\/[a-z0-9-]*\.trycloudflare\.com/g);
    return matches ? matches[matches.length - 1] : null;
  } catch {
    return null;
  }
}

function getSavedUrl() {
  try {
    return fs.readFileSync(URL_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function updateGist(url, status) {
  return new Promise((resolve) => {
    const timestamp = new Date().toISOString();
    const content = JSON.stringify({ relayUrl: url, relayKey: RELAY_KEY, updatedAt: timestamp, status });

    const body = JSON.stringify({ files: { 'relay-config.json': { content } } });

    const options = {
      hostname: 'api.github.com',
      path: `/gists/${GIST_ID}`,
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SONA-Relay-Watchdog',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          log(`GIST UPDATED: ${url} (status=${status})`);
          resolve(true);
        } else {
          log(`GIST UPDATE FAILED: HTTP ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      log(`GIST UPDATE ERROR: ${e.message}`);
      resolve(false);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      log('GIST UPDATE TIMEOUT');
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}

function checkLocalRelay() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/health', { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).status === 'ok'); }
        catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function checkTunnelHealth(url) {
  return new Promise((resolve) => {
    const req = https.get(`${url}/health`, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).status === 'ok'); }
        catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      resolve({ success: !error, stdout: stdout?.trim(), stderr: stderr?.trim() });
    });
  });
}

async function runCheck() {
  log('--- Running periodic check ---');

  // 1. Quick check local relay
  const relayOk = await checkLocalRelay();
  if (!relayOk) {
    log('LOCAL RELAY UNHEALTHY - attempting restart...');
    await runCommand('pm2 restart sona-email-relay');
    log('RELAY RESTARTED');
  } else {
    log('Local relay: OK');
  }

  // 2. Get current tunnel URL
  const currentUrl = getTunnelUrl();
  if (!currentUrl) {
    log('NO TUNNEL URL FOUND - tunnel might need restart');
    const tunnelResult = await runCommand('pm2 restart cloudflared-tunnel');
    log('TUNNEL RESTARTED - will check URL on next cycle');
    return;
  }

  // 3. Check if URL changed
  const savedUrl = getSavedUrl();
  if (currentUrl !== savedUrl) {
    log(`TUNNEL URL CHANGED: ${savedUrl || 'none'} -> ${currentUrl}`);
    fs.writeFileSync(URL_FILE, currentUrl);

    const healthy = await checkTunnelHealth(currentUrl);
    const status = healthy ? 'active' : 'inactive';
    log(`TUNNEL HEALTH: ${healthy ? 'OK' : 'FAILED'}`);

    await updateGist(currentUrl, status);
  } else {
    // Verify existing tunnel still works
    const healthy = await checkTunnelHealth(currentUrl);
    if (!healthy) {
      log(`TUNNEL UNHEALTHY at ${currentUrl}`);
      await updateGist(currentUrl, 'inactive');
    } else {
      log(`Tunnel OK: ${currentUrl}`);
    }
  }
}

// Start the watchdog
log('🐕 SONA Relay Watchdog v2 started (checking every 5 minutes)');
runCheck();
setInterval(runCheck, CHECK_INTERVAL);
