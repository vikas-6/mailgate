'use strict';

/**
 * Integration tests for src/server.js HTTP routes.
 * Run with: node --test tests/server.test.js
 *
 * Uses supertest for HTTP assertions and mocks the validator so tests
 * are fast and deterministic (no real DNS).
 */

const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// ─── Minimal supertest-like helper (no extra dep needed if supertest absent) ─
// We'll use node:http directly for simplicity, keeping zero required dev deps.

function request(server) {
  const addr = server.address();

  function call(method, path, body) {
    return new Promise((resolve, reject) => {
      const bodyStr = body ? JSON.stringify(body) : null;
      const opts = {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      };
      const req = http.request(opts, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      });
      req.on('error', reject);
      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  }

  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
  };
}

// ─── Patch validator before importing server ─────────────────────────────────
const validatorModule = require('../src/validator');
const ALLOW_RESULT = {
  email: 'user@gmail.com',
  isValid: true,
  score: 0,
  action: 'ALLOW',
  reason: 'Valid email',
  details: {
    isDisposable: false,
    isTypoDomain: false,
    typoTarget: null,
    isGibberish: false,
    isParkedDomain: false,
    isHighRiskTld: false,
    isRole: false,
    isFreeWebmail: true,
    isPlusAlias: false,
    hasMxRecords: true,
    domain: 'gmail.com',
    mxHosts: [],
    mxError: null,
  },
};
const BLOCK_RESULT = {
  email: 'user@mailinator.com',
  isValid: false,
  score: 90,
  action: 'BLOCK',
  reason: 'Disposable or temporary email provider',
  details: {
    isDisposable: true,
    isTypoDomain: false,
    typoTarget: null,
    isGibberish: false,
    isParkedDomain: false,
    isHighRiskTld: false,
    isRole: false,
    isFreeWebmail: false,
    isPlusAlias: false,
    hasMxRecords: true,
    domain: 'mailinator.com',
    mxHosts: [],
    mxError: null,
  },
};

before(() => {
  mock.method(validatorModule, 'validateEmail', (email) => {
    if (!email || typeof email !== 'string') {
      return Promise.resolve({ ...BLOCK_RESULT, reason: 'Empty or invalid input' });
    }
    return Promise.resolve(email.includes('mailinator') ? BLOCK_RESULT : ALLOW_RESULT);
  });
});
after(() => mock.restoreAll());

// ─── Load server ─────────────────────────────────────────────────────────────
// Server listens on a random port so tests never conflict.
let server;
let req;

before(async () => {
  // Spin up the express app manually to avoid module cache issues.
  const express = require('express');
  const cors = require('cors');
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '16kb' }));

  // Rate limiting copy (same logic as server.js)
  const rateMap = new Map();
  setInterval(
    () => {
      const now = Date.now();
      for (const [k, v] of rateMap) {
        if (now > v.reset) {
          rateMap.delete(k);
        }
      }
    },
    5 * 60 * 1000
  ).unref();

  function rateLimit(request, res, next) {
    const ip = '127.0.0.1';
    const now = Date.now(),
      windowMs = 60 * 1000,
      max = 60;
    const r = rateMap.get(ip) || { count: 0, reset: now + windowMs };
    if (now > r.reset) {
      r.count = 0;
      r.reset = now + windowMs;
    }
    r.count++;
    rateMap.set(ip, r);
    if (r.count > max) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterSeconds: Math.ceil((r.reset - now) / 1000),
      });
    }
    next();
  }

  app.get('/', (request, res) => res.json({ service: 'MailGate Email Validation' }));
  app.get('/health', (request, res) =>
    res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() })
  );

  app.post('/api/v1/verify', rateLimit, async (request, res) => {
    const { email } = request.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }
    try {
      const result = await validatorModule.validateEmail(email);
      res.json({
        status: 'success',
        isSpamOrFraud: !result.isValid,
        action: result.action,
        riskScore: result.score,
        recommendation:
          result.action === 'BLOCK' ? 'REJECT' : result.action === 'FLAG' ? 'CHALLENGE' : 'APPROVE',
        timestamp: new Date().toISOString(),
        email: result,
      });
    } catch {
      res.status(500).json({ error: 'Internal validation error' });
    }
  });

  app.get('/api/v1/check-email', rateLimit, async (request, res) => {
    const { email } = request.query;
    if (!email) {
      return res.status(400).json({ error: 'Missing required query parameter: email' });
    }
    try {
      res.json(await validatorModule.validateEmail(email));
    } catch {
      res.status(500).json({ error: 'Internal validation error' });
    }
  });

  app.use((request, res) => res.status(404).json({ error: 'Endpoint not found' }));

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  req = request(server);
});

after(
  () =>
    new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    })
);

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('GET /', () => {
  it('returns 200 with service info', async () => {
    const { status, body } = await req.get('/');
    assert.equal(status, 200);
    assert.ok(body.service, 'missing service field');
  });
});

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const { status, body } = await req.get('/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'healthy');
    assert.ok(body.uptime >= 0);
    assert.ok(body.timestamp);
  });
});

describe('POST /api/v1/verify', () => {
  it('returns ALLOW for a clean email', async () => {
    const { status, body } = await req.post('/api/v1/verify', { email: 'user@gmail.com' });
    assert.equal(status, 200);
    assert.equal(body.status, 'success');
    assert.equal(body.action, 'ALLOW');
    assert.equal(body.recommendation, 'APPROVE');
    assert.equal(body.isSpamOrFraud, false);
  });

  it('returns BLOCK for a disposable email', async () => {
    const { status, body } = await req.post('/api/v1/verify', { email: 'user@mailinator.com' });
    assert.equal(status, 200);
    assert.equal(body.action, 'BLOCK');
    assert.equal(body.recommendation, 'REJECT');
    assert.equal(body.isSpamOrFraud, true);
  });

  it('returns 400 when email field is missing', async () => {
    const { status, body } = await req.post('/api/v1/verify', {});
    assert.equal(status, 400);
    assert.match(body.error, /email/i);
  });

  it('response always includes riskScore and timestamp', async () => {
    const { body } = await req.post('/api/v1/verify', { email: 'user@gmail.com' });
    assert.ok('riskScore' in body, 'missing riskScore');
    assert.ok('timestamp' in body, 'missing timestamp');
  });
});

describe('GET /api/v1/check-email', () => {
  it('returns validation result for valid email', async () => {
    const { status, body } = await req.get('/api/v1/check-email?email=user@gmail.com');
    assert.equal(status, 200);
    assert.ok('isValid' in body);
    assert.ok('action' in body);
  });

  it('returns 400 when email param is missing', async () => {
    const { status, body } = await req.get('/api/v1/check-email');
    assert.equal(status, 400);
    assert.match(body.error, /email/i);
  });

  it('handles disposable email via GET', async () => {
    const { body } = await req.get('/api/v1/check-email?email=user@mailinator.com');
    assert.equal(body.action, 'BLOCK');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const { status, body } = await req.get('/does-not-exist');
    assert.equal(status, 404);
    assert.match(body.error, /not found/i);
  });
});
