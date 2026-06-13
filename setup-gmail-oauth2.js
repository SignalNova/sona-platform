/**
 * Gmail API OAuth2 Setup Script
 * 
 * This script helps you obtain OAuth2 credentials for Gmail API.
 * Once set up, emails will be sent via Gmail API (HTTPS-based),
 * which works on ALL hosting platforms including Render.
 * 
 * Prerequisites:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project (e.g., "sona-email-service")
 * 3. Enable Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
 * 4. Configure OAuth consent screen:
 *    - User type: External
 *    - App name: SONA Email Service
 *    - User support email: helpsona.support@gmail.com
 *    - Add test user: helpsona.support@gmail.com
 *    - Scopes: https://mail.google.com/
 * 5. Create OAuth2 credentials:
 *    - Application type: Desktop app
 *    - Name: SONA Email Sender
 *    - Copy the Client ID and Client Secret
 * 
 * Usage:
 *   node setup-gmail-oauth2.js
 * 
 * Then enter the Client ID and Client Secret when prompted.
 * The script will generate an authorization URL - open it in your browser,
 * log in with helpsona.support@gmail.com, and paste the authorization code.
 */

const http = require('http');
const url = require('url');

// The redirect URI for the OAuth2 flow
const REDIRECT_URI = 'http://localhost:3002/oauth2callback';
const SCOPES = ['https://mail.google.com/'];

async function main() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║      SONA Platform - Gmail API OAuth2 Setup            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('This script will help you get OAuth2 credentials for Gmail API.');
  console.log('');

  // Get Client ID and Secret
  const clientId = await question('Enter your Google OAuth2 Client ID: ');
  const clientSecret = await question('Enter your Google OAuth2 Client Secret: ');
  
  if (!clientId || !clientSecret) {
    console.error('Error: Client ID and Client Secret are required.');
    process.exit(1);
  }

  // Generate authorization URL
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(SCOPES.join(' '))}&` +
    `access_type=offline&` +
    `prompt=consent`;

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Open this URL in your browser:');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log('Step 2: Log in with helpsona.support@gmail.com');
  console.log('Step 3: Authorize the application');
  console.log('Step 4: The page will redirect to localhost - copy the "code" parameter from the URL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Option A: Start a local server to catch the callback
  // Option B: Manual code entry
  const method = await question('Use automatic callback (a) or manual code entry (m)? [a/m]: ');
  
  let authCode = '';
  
  if (method.toLowerCase() === 'a') {
    // Start a local server to catch the callback
    authCode = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const query = url.parse(req.url, true).query;
        if (query.code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization successful!</h1><p>You can close this tab.</p>');
          server.close();
          resolve(query.code);
        } else {
          res.writeHead(400);
          res.end('No authorization code found.');
          server.close();
          reject(new Error('No authorization code in callback'));
        }
      });
      
      server.listen(3002, () => {
        console.log('Waiting for callback on http://localhost:3002 ...');
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Timeout waiting for callback'));
      }, 300000);
    });
  } else {
    authCode = await question('Enter the authorization code from the URL: ');
  }
  
  rl.close();
  
  if (!authCode) {
    console.error('Error: Authorization code is required.');
    process.exit(1);
  }

  // Exchange authorization code for tokens
  console.log('');
  console.log('Exchanging authorization code for tokens...');
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: authCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenResponse.json();
  
  if (tokens.error) {
    console.error('Error exchanging code:', tokens.error, tokens.error_description);
    process.exit(1);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          OAuth2 Credentials Obtained! ✅                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Add these environment variables to your .env and Render:');
  console.log('');
  console.log(`GMAIL_CLIENT_ID=${clientId}`);
  console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('');
  console.log('With these credentials, the Gmail API method will work on Render!');
  console.log('The app will automatically use Gmail API as the primary email method.');
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
