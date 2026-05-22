const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';
const SELF_PING_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || `http://localhost:${PORT}`;
const PING_INTERVAL = Number(process.env.PING_INTERVAL) || 5 * 60 * 1000;

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── STATE ─────────────────────────────────────────────────

let extensionSocket = null;                  // the connected extension
const pendingJobs = new Map();               // jobId → { resolve, reject, timer }

// ── AUTH ──────────────────────────────────────────────────

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const key = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '') || req.query.api_key;
  if (key === API_KEY) return next();
  return res.status(401).json({ error: 'Invalid or missing API key' });
}

// ── WEBSOCKET ─────────────────────────────────────────────

wss.on('connection', (ws, req) => {
  // Simple token check for extension connections
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (API_KEY && token !== API_KEY) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  extensionSocket = ws;
  console.log('[WS] Extension connected');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      // msg = { jobId, success, result, error }
      const job = pendingJobs.get(msg.jobId);
      if (!job) return;
      clearTimeout(job.timer);
      pendingJobs.delete(msg.jobId);
      if (msg.success) job.resolve(msg.result);
      else job.reject(new Error(msg.error || 'Extension returned error'));
    } catch (e) {
      console.error('[WS] Bad message:', e.message);
    }
  });

  ws.on('close', () => {
    extensionSocket = null;
    console.log('[WS] Extension disconnected');
    // Fail all pending jobs
    for (const [jobId, job] of pendingJobs) {
      clearTimeout(job.timer);
      job.reject(new Error('Extension disconnected'));
      pendingJobs.delete(jobId);
    }
  });

  ws.on('error', (e) => console.error('[WS] Error:', e.message));
});

// ── JOB DISPATCHER ────────────────────────────────────────

function dispatchJob(provider, actionType, params, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      return reject(new Error('Extension not connected'));
    }

    const jobId = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingJobs.delete(jobId);
      reject(new Error('Job timed out'));
    }, timeoutMs);

    pendingJobs.set(jobId, { resolve, reject, timer });

    extensionSocket.send(JSON.stringify({ jobId, provider, actionType, params }));
  });
}

// ── ROUTES ────────────────────────────────────────────────

app.get('/status', (req, res) => {
  res.json({
    ok: true,
    extensionConnected: !!(extensionSocket && extensionSocket.readyState === WebSocket.OPEN),
    pendingJobs: pendingJobs.size
  });
});

// POST /run  { provider, action, message }
app.post('/run', requireApiKey, async (req, res) => {
  const { provider, action, message, prompt, target, email, password } = req.body;
  if (!provider) return res.status(400).json({ error: 'provider required' });
  if (!action)   return res.status(400).json({ error: 'action required' });

  const params = {};
  if (action === 'prompt') params.message  = message || prompt;
  if (action === 'image')  params.prompt   = message || prompt;
  if (action === 'change') params.target   = target;
  if (action === 'login')  { params.email  = email; params.password = password; }

  try {
    const result = await dispatchJob(provider, action, params);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /run?provider=claude&action=prompt&message=hello
app.get('/run', requireApiKey, async (req, res) => {
  const { provider, action, message, prompt } = req.query;
  if (!provider) return res.status(400).json({ error: 'provider required' });
  if (!action)   return res.status(400).json({ error: 'action required' });

  const params = {};
  if (action === 'prompt') params.message = message || prompt;
  if (action === 'image')  params.prompt  = message || prompt;

  try {
    const result = await dispatchJob(provider, action, params);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shorthand: POST /prompt/:provider  { message }
app.post('/prompt/:provider', requireApiKey, async (req, res) => {
  const { provider } = req.params;
  const { message, prompt } = req.body;
  const text = message || prompt;
  if (!text) return res.status(400).json({ error: 'message required' });

  try {
    const result = await dispatchJob(provider, 'prompt', { message: text });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /prompt/:provider?message=hello
app.get('/prompt/:provider', requireApiKey, async (req, res) => {
  const { provider } = req.params;
  const text = req.query.message || req.query.prompt;
  if (!text) return res.status(400).json({ error: 'message required' });

  try {
    const result = await dispatchJob(provider, 'prompt', { message: text });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/jobs', requireApiKey, (req, res) => {
  res.json({ pending: pendingJobs.size, jobs: [...pendingJobs.keys()] });
});

// ── SELF PINGER ───────────────────────────────────────────

function startSelfPinger() {
  let baseUrl = SELF_PING_URL.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;
  const pingUrl = `${baseUrl}/status`;
  const client = pingUrl.startsWith('https') ? https : http;

  setInterval(() => {
    client.get(pingUrl, (res) => {
      console.log(`[PING] ${res.statusCode} ${new Date().toLocaleTimeString()}`);
    }).on('error', (e) => console.warn(`[PING] Failed: ${e.message}`));
  }, PING_INTERVAL);

  console.log(`[PING] Started → ${pingUrl} every ${PING_INTERVAL / 1000}s`);
}

// ── START ─────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  startSelfPinger();
});
