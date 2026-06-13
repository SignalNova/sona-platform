/**
 * SONA Email Relay Server - Production Version
 * 
 * Lightweight HTTPS API that accepts email requests and sends them
 * via Gmail SMTP. Designed for platforms that block SMTP (like Render).
 * 
 * Security: API key authentication, rate limiting, input validation
 */

const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Configuration from environment
const PORT = parseInt(process.env.RELAY_PORT || '3001');
const API_KEY = process.env.RELAY_API_KEY || '';
const GMAIL_USER = process.env.SMTP_USER || 'helpsona.support@gmail.com';
const GMAIL_PASS = process.env.SMTP_PASS || '';
const MAX_REQUESTS_PER_MINUTE = 30;

if (!API_KEY) {
  console.error('[RELAY] FATAL: RELAY_API_KEY environment variable is required');
  process.exit(1);
}

if (!GMAIL_PASS) {
  console.error('[RELAY] FATAL: SMTP_PASS environment variable is required');
  process.exit(1);
}

// Rate limiting store
const rateLimitStore = new Map();

// Clean up rate limit store every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore) {
    const filtered = timestamps.filter(t => now - t < 120000);
    if (filtered.length === 0) rateLimitStore.delete(ip);
    else rateLimitStore.set(ip, filtered);
  }
}, 300000);

// Create Gmail SMTP transporter with connection pooling
let transporter = null;
let lastVerifyTime = 0;

function getTransporter() {
  if (transporter) return transporter;
  
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
    family: 4,
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 10,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });
  
  return transporter;
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Relay-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Rate limiting
app.use((req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimitStore.has(clientIp)) {
    rateLimitStore.set(clientIp, []);
  }
  
  const timestamps = rateLimitStore.get(clientIp).filter(t => now - t < 60000);
  timestamps.push(now);
  rateLimitStore.set(clientIp, timestamps);
  
  if (timestamps.length > MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  next();
});

// API key auth
const requireAuth = (req, res, next) => {
  const key = req.headers['x-relay-key'] || req.query.key;
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
};

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'sona-email-relay',
    version: '2.0.0',
    smtpReady: transporter !== null,
    timestamp: new Date().toISOString() 
  });
});

// SMTP verification
app.get('/api/verify-smtp', requireAuth, async (req, res) => {
  try {
    await getTransporter().verify();
    lastVerifyTime = Date.now();
    res.json({ success: true, message: 'SMTP connection is ready' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send email
app.post('/api/send-email', requireAuth, async (req, res) => {
  const { to, subject, html, text, from } = req.body;
  
  if (!to || !subject) {
    return res.status(400).json({ error: 'Missing required fields: to, subject' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid recipient email format' });
  }
  
  try {
    const transport = getTransporter();
    const fromAddress = from || `"SONA Platform" <${GMAIL_USER}>`;
    
    const info = await transport.sendMail({
      from: fromAddress,
      to,
      subject,
      html: html || undefined,
      text: text || subject,
      headers: {
        'X-Mailer': 'SONA-Platform-Mailer/2.0',
        'X-Priority': '3',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
    });
    
    console.log(`[RELAY] ✉ Sent to ${to} (ID: ${info.messageId})`);
    res.json({ 
      success: true, 
      messageId: info.messageId,
    });
    
  } catch (error) {
    console.error(`[RELAY] ✗ Failed for ${to}: ${error.message}`);
    
    // If transporter is broken, reset it
    if (error.code === 'ECONNECTION' || error.code === 'EAUTH') {
      try { transporter.close(); } catch(e) {}
      transporter = null;
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server
async function start() {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('[RELAY] SMTP connection verified ✓');
  } catch (err) {
    console.error('[RELAY] SMTP verification failed:', err.message);
    console.log('[RELAY] Starting anyway - SMTP will retry on first request');
    transporter = null;
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RELAY] 🚀 Email relay server running on port ${PORT}`);
    console.log(`[RELAY] 📧 Gmail sender: ${GMAIL_USER}`);
    console.log(`[RELAY] 🔑 API key configured`);
    console.log(`[RELAY] 🏥 Health: http://localhost:${PORT}/health`);
  });
}

start();
