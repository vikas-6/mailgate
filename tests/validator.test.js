
'use strict';

/**
 * Unit tests for src/validator.js
 * Run with: node --test tests/validator.test.js
 */

const { describe, it, mock, before, after } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

// ─── DNS mock helpers ───────────────────────────────────────────────────────
// We stub dns.promises.resolveMx before requiring the module so the module
// under test always uses our mock.

let resolveMxImpl = async () => [{ exchange: 'mx.example.com', priority: 10 }];

before(() => {
  mock.method(dns.promises, 'resolveMx', (...args) => resolveMxImpl(...args));
});

after(() => mock.restoreAll());

const { validateEmail } = require('../src/validator');

// ─── Helper ──────────────────────────────────────────────────────────────────
function makeMx(host) {
  resolveMxImpl = async () => [{ exchange: host, priority: 10 }];
}
function noMx() {
  resolveMxImpl = async () => {
    throw new Error('ENOTFOUND');
  };
}
function emptyMx() {
  resolveMxImpl = async () => [];
}

// ─── Input validation ────────────────────────────────────────────────────────
describe('Input validation', () => {
  it('blocks null input', async () => {
    const r = await validateEmail(null);
    assert.equal(r.isValid, false);
    assert.equal(r.action, 'BLOCK');
  });

  it('blocks empty string', async () => {
    const r = await validateEmail('');
    assert.equal(r.isValid, false);
    assert.equal(r.action, 'BLOCK');
  });

  it('blocks non-string input', async () => {
    const r = await validateEmail(12345);
    assert.equal(r.isValid, false);
    assert.equal(r.action, 'BLOCK');
  });

  it('blocks oversized email (>320 chars)', async () => {
    const r = await validateEmail('a'.repeat(300) + '@example.com');
    assert.equal(r.isValid, false);
    assert.equal(r.action, 'BLOCK');
  });

  it('blocks malformed email syntax', async () => {
    const r = await validateEmail('not-an-email');
    assert.equal(r.isValid, false);
    assert.equal(r.action, 'BLOCK');
    assert.match(r.reason, /RFC 5322/);
  });

  it('blocks email with no domain', async () => {
    const r = await validateEmail('user@');
    assert.equal(r.isValid, false);
    assert.equal(r.action, 'BLOCK');
  });
});

// ─── Disposable / temporary providers ───────────────────────────────────────
describe('Disposable email detection', () => {
  before(() => makeMx('mail.mailinator.com'));

  it('blocks mailinator.com', async () => {
    const r = await validateEmail('user@mailinator.com');
    assert.equal(r.isValid, false);
    assert.equal(r.action, 'BLOCK');
    assert.equal(r.details.isDisposable, true);
  });

  it('blocks guerrillamail.com', async () => {
    makeMx('mx.guerrillamail.com');
    const r = await validateEmail('user@guerrillamail.com');
    assert.equal(r.details.isDisposable, true);
    assert.equal(r.action, 'BLOCK');
  });

  it('blocks yopmail.com', async () => {
    makeMx('mx.yopmail.com');
    const r = await validateEmail('user@yopmail.com');
    assert.equal(r.details.isDisposable, true);
    assert.equal(r.action, 'BLOCK');
  });

  it('blocks trashmail.com', async () => {
    makeMx('mx.trashmail.com');
    const r = await validateEmail('user@trashmail.com');
    assert.equal(r.details.isDisposable, true);
  });
});

// ─── Legitimate email providers ──────────────────────────────────────────────
describe('Legitimate providers', () => {
  before(() => makeMx('gmail-smtp-in.l.google.com'));

  it('allows gmail.com', async () => {
    const r = await validateEmail('user@gmail.com');
    assert.equal(r.action, 'ALLOW');
    assert.equal(r.details.isFreeWebmail, true);
  });

  it('allows outlook.com', async () => {
    makeMx('outlook-com.olc.protection.outlook.com');
    const r = await validateEmail('user@outlook.com');
    assert.equal(r.action, 'ALLOW');
  });

  it('allows proton.me', async () => {
    makeMx('mail.protonmail.ch');
    const r = await validateEmail('user@proton.me');
    assert.equal(r.action, 'ALLOW');
  });

  it('normalises email to lowercase', async () => {
    makeMx('gmail-smtp-in.l.google.com');
    const r = await validateEmail('User@GMAIL.COM');
    assert.equal(r.email, 'user@gmail.com');
  });
});

// ─── Typo-squatting detection ─────────────────────────────────────────────
describe('Typo-squatted domain detection', () => {
  it('blocks known typo doogle.com', async () => {
    makeMx('mx.doogle.com');
    const r = await validateEmail('user@doogle.com');
    assert.equal(r.details.isTypoDomain, true);
    assert.notEqual(r.action, 'ALLOW');
  });

  it('blocks known typo gamil.com', async () => {
    makeMx('mx.gamil.com');
    const r = await validateEmail('user@gamil.com');
    assert.equal(r.details.isTypoDomain, true);
  });

  it('does NOT flag gmail.com as a typo', async () => {
    makeMx('gmail-smtp-in.l.google.com');
    const r = await validateEmail('user@gmail.com');
    assert.equal(r.details.isTypoDomain, false);
  });

  it('does NOT flag me.com as typo of msn.com', async () => {
    makeMx('mx.mail.me.com');
    const r = await validateEmail('user@me.com');
    assert.equal(r.details.isTypoDomain, false);
  });
});

// ─── Role-based addresses ────────────────────────────────────────────────────
describe('Role-based address detection', () => {
  before(() => makeMx('mx.example.com'));

  it('flags admin@', async () => {
    const r = await validateEmail('admin@example.com');
    assert.equal(r.details.isRole, true);
    assert.notEqual(r.action, 'BLOCK'); // role alone shouldn't block
  });

  it('flags noreply@', async () => {
    const r = await validateEmail('noreply@example.com');
    assert.equal(r.details.isRole, true);
  });

  it('flags support@', async () => {
    const r = await validateEmail('support@example.com');
    assert.equal(r.details.isRole, true);
  });

  it('does NOT flag regular user@', async () => {
    const r = await validateEmail('john@example.com');
    assert.equal(r.details.isRole, false);
  });
});

// ─── High-risk TLD detection ─────────────────────────────────────────────────
describe('High-risk TLD detection', () => {
  it('flags .tk domain', async () => {
    makeMx('mx.example.tk');
    const r = await validateEmail('user@example.tk');
    assert.equal(r.details.isHighRiskTld, true);
  });

  it('flags .ml domain', async () => {
    makeMx('mx.example.ml');
    const r = await validateEmail('user@example.ml');
    assert.equal(r.details.isHighRiskTld, true);
  });

  it('does NOT flag .com as high-risk', async () => {
    makeMx('mx.example.com');
    const r = await validateEmail('user@example.com');
    assert.equal(r.details.isHighRiskTld, false);
  });
});

// ─── Gibberish username detection ────────────────────────────────────────────
describe('Gibberish/bot username detection', () => {
  before(() => makeMx('mx.gmail.com'));

  it('flags long random consonant string', async () => {
    const r = await validateEmail('xvqzwprk@gmail.com');
    assert.equal(r.details.isGibberish, true);
  });

  it('does NOT flag normal name', async () => {
    const r = await validateEmail('john.doe@gmail.com');
    assert.equal(r.details.isGibberish, false);
  });

  it('does NOT flag name with year (e.g. john1995)', async () => {
    const r = await validateEmail('john1995@gmail.com');
    assert.equal(r.details.isGibberish, false);
  });

  it('does NOT flag short username', async () => {
    const r = await validateEmail('jd@gmail.com');
    assert.equal(r.details.isGibberish, false);
  });
});

// ─── MX record checks ────────────────────────────────────────────────────────
describe('MX record validation', () => {
  it('blocks domain with no MX records (unknown domain)', async () => {
    noMx();
    const r = await validateEmail('user@no-mx-domain-xyz123.com');
    assert.equal(r.details.hasMxRecords, false);
    assert.notEqual(r.action, 'ALLOW');
  });

  it('blocks domain with empty MX response', async () => {
    emptyMx();
    const r = await validateEmail('user@empty-mx.com');
    assert.equal(r.details.hasMxRecords, false);
  });

  it('treats free webmail as live on DNS failure', async () => {
    noMx();
    const r = await validateEmail('user@gmail.com');
    // gmail.com is in FREE_WEBMAIL_DOMAINS, so hasMxRecords stays true
    assert.equal(r.details.hasMxRecords, true);
  });
});

// ─── Parked domain detection ─────────────────────────────────────────────────
describe('Parked domain detection', () => {
  it('flags domain with sedo parking MX', async () => {
    makeMx('parking.sedo.com');
    const r = await validateEmail('user@parked-example.com');
    assert.equal(r.details.isParkedDomain, true);
    assert.notEqual(r.action, 'ALLOW');
  });

  it('flags domain with domaincontrol.com MX', async () => {
    makeMx('smtp.domaincontrol.com');
    const r = await validateEmail('user@unused-domain.com');
    assert.equal(r.details.isParkedDomain, true);
  });
});

// ─── Temp MX host detection ───────────────────────────────────────────────────
describe('Temp-mail MX host detection', () => {
  it('detects mailtm MX as disposable', async () => {
    makeMx('mail.mailtm.com');
    const r = await validateEmail('user@customdomain.com');
    assert.equal(r.details.isDisposable, true);
  });
});

// ─── Plus-alias handling ─────────────────────────────────────────────────────
describe('Plus-alias handling', () => {
  it('detects plus-alias tag', async () => {
    makeMx('gmail-smtp-in.l.google.com');
    const r = await validateEmail('user+tag@gmail.com');
    assert.equal(r.details.isPlusAlias, true);
    assert.equal(r.action, 'ALLOW');
  });
});

// ─── Score & action thresholds ───────────────────────────────────────────────
describe('Score and action thresholds', () => {
  it('score is always between 0 and 100', async () => {
    makeMx('mail.mailinator.com');
    const r = await validateEmail('xvqzwrpk@mailinator.com'); // multiple signals
    assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} out of range`);
  });

  it('isValid is false when action is BLOCK', async () => {
    makeMx('mail.mailinator.com');
    const r = await validateEmail('user@mailinator.com');
    assert.equal(r.action, 'BLOCK');
    assert.equal(r.isValid, false);
  });

  it('result always has required fields', async () => {
    makeMx('mx.example.com');
    const r = await validateEmail('user@example.com');
    assert.ok('email' in r, 'missing email');
    assert.ok('isValid' in r, 'missing isValid');
    assert.ok('score' in r, 'missing score');
    assert.ok('action' in r, 'missing action');
    assert.ok('reason' in r, 'missing reason');
    assert.ok('details' in r, 'missing details');
  });
});
