const express = require('express');
const cors = require('cors');
const { validateEmail } = require('./validator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '16kb' }));

// Simple IP-based rate limiting — no API key needed, it's free
const rateMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateMap) if (now > v.reset) rateMap.delete(k);
}, 5 * 60 * 1000).unref();

function rateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
  const now = Date.now(), windowMs = 60 * 1000, max = 60;
  const r = rateMap.get(ip) || { count: 0, reset: now + windowMs };
  if (now > r.reset) { r.count = 0; r.reset = now + windowMs; }
  r.count++;
  rateMap.set(ip, r);
  if (r.count > max) return res.status(429).json({ error: 'Rate limit exceeded', retryAfterSeconds: Math.ceil((r.reset - now) / 1000) });
  next();
}

app.get('/', (req, res) => {
  res.json({
    service: 'MailGate Email Validation',
    version: '1.0.1',
    npm: 'https://www.npmjs.com/package/mailgate',
    endpoints: {
      health: 'GET /health',
      verify: 'POST /api/v1/verify  { email }',
      checkEmail: 'GET /api/v1/check-email?email=user@domain.com'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.post('/api/v1/verify', rateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing required field: email' });
  try {
    const result = await validateEmail(email);
    res.json({
      status: 'success',
      isSpamOrFraud: !result.isValid,
      action: result.action,
      riskScore: result.score,
      recommendation: result.action === 'BLOCK' ? 'REJECT' : result.action === 'FLAG' ? 'CHALLENGE' : 'APPROVE',
      timestamp: new Date().toISOString(),
      email: result
    });
  } catch {
    res.status(500).json({ error: 'Internal validation error' });
  }
});

app.get('/api/v1/check-email', rateLimit, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Missing required query parameter: email' });
  try {
    res.json(await validateEmail(email));
  } catch {
    res.status(500).json({ error: 'Internal validation error' });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));

app.listen(PORT, () => console.log(`[MailGate] Server running on port ${PORT}`));
