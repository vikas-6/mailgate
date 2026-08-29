const dns = require('dns').promises;
const validator = require('validator');
const disposableDomainsList = require('./data/disposable-domains.json');
const {
  THRESHOLDS,
  ROLE_USERNAMES,
  FREE_WEBMAIL_DOMAINS,
  TYPO_DOMAINS,
} = require('./config/constants');

const disposableSet = new Set(disposableDomainsList.map((d) => d.toLowerCase()));

// Reference list used only for Levenshtein typo-distance checks
const TYPO_REFERENCE_DOMAINS = [
  'gmail.com',
  'google.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'zoho.com',
  'live.com',
  'msn.com',
  'yandex.com',
];

const TEMP_MX_HOST_PATTERNS = [
  'mailtm',
  'mail.tm',
  'mailinator',
  'guerrillamail',
  'yopmail',
  'trashmail',
  'inboxkitten',
  'discard.email',
  'dispostable',
  'temp-mail',
  'tempmail',
  'emailondeck',
  'mohmal',
  'maildrop',
  'anonaddy',
  'simplelogin',
  'forwardemail',
  'improvmx',
];

const PARKED_MX_HOST_PATTERNS = [
  'sedo',
  'dan.com',
  'parklogic',
  'bodis',
  'above.com',
  'parking',
  'hugedomains',
  'undeveloped',
  'domaincontrol.com',
  'registrar-servers.com',
  'parkingcrew',
];

const HIGH_RISK_TLDS = [
  '.tk',
  '.ml',
  '.ga',
  '.cf',
  '.gq',
  '.cfd',
  '.icu',
  '.site',
  '.click',
  '.ccwu.cc',
  '.dynv6.net',
  '.cloudns.cc',
  '.io.vn',
  '.fr.nf',
  '.eu.cc',
  // ponytail: .top/.xyz/.xyz removed: too many legit businesses use them (x.com, etc.)
];

// Keywords matched only against the registered domain label (before first dot),
// NOT as a substring of full domain — prevents false positives like spamassassin.apache.org
const SUSPICIOUS_DOMAIN_LABELS = new Set([
  'tempmail',
  'disposable',
  'trashmail',
  'fakemail',
  'burnermail',
  'guerrillamail',
  'throwaway',
  '10minutemail',
  '20minutemail',
  'tmpmail',
  'spammail',
  'catchall',
  'sharklaser',
  'maildrop',
  'mailgenerator',
]);

const MAX_EMAIL_LENGTH = 320; // RFC 5321 maximum

/**
 * Computes Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
    }
  }
  return dp[m][n];
}

/**
 * Detects typo-squatted brand domains.
 * Skips check for known-legitimate webmail domains to prevent false positives
 * (e.g. me.com falsely matching msn.com via edit distance).
 */
function detectTypoDomain(domain) {
  // Never flag known legitimate providers as typos
  if (FREE_WEBMAIL_DOMAINS.has(domain)) {
    return { isTypo: false, targetDomain: null };
  }

  if (TYPO_DOMAINS.has(domain)) {
    return { isTypo: true, targetDomain: 'known typo list' };
  }

  for (const target of TYPO_REFERENCE_DOMAINS) {
    if (domain === target) {
      return { isTypo: false, targetDomain: null };
    }
    const dist = levenshtein(domain, target);
    if (dist <= 2 && Math.abs(domain.length - target.length) <= 2) {
      return { isTypo: true, targetDomain: target };
    }
  }

  return { isTypo: false, targetDomain: null };
}

/**
 * Detects randomly generated (bot) usernames via character-class heuristics.
 * Uses a linear O(n) counter to avoid ReDoS.
 */
function isGibberishUsername(local) {
  const clean = local.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.length < 6) {
    return false;
  }

  const CONSONANTS = new Set('bcdfghjklmnpqrstvwxyz');
  let maxRun = 0,
    run = 0;
  for (const ch of clean) {
    run = CONSONANTS.has(ch) ? run + 1 : 0;
    if (run > maxRun) {
      maxRun = run;
    }
  }
  if (maxRun >= 4) {
    return true;
  }

  const digits = clean.replace(/[^0-9]/g, '').length;
  const letters = clean.replace(/[^a-z]/g, '').length;
  if (clean.length >= 7 && digits >= 2 && letters >= 4) {
    if (!/19\d\d|20\d\d/.test(clean)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves MX records with a hard timeout. Timer is always cleared to prevent leaks.
 */
function resolveMxWithTimeout(domain, ms = 2500) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('DNS lookup timeout')), ms);
  });
  return Promise.race([dns.resolveMx(domain), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Returns true if the domain's registered label (leftmost part) is a known
 * suspicious keyword. Avoids substring false positives like spamassassin.apache.org.
 */
function hasSuspiciousDomainLabel(domain) {
  // Extract the registered domain label: e.g. "tempmail.com" -> "tempmail"
  const parts = domain.split('.');
  const registeredLabel = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return SUSPICIOUS_DOMAIN_LABELS.has(registeredLabel);
}

/**
 * Validates an email address and returns a structured risk assessment.
 *
 * @param {string} email - The email address to validate.
 * @returns {Promise<{
 *   email: string,
 *   isValid: boolean,
 *   score: number,
 *   action: 'ALLOW'|'FLAG'|'BLOCK',
 *   reason: string,
 *   details: Object
 * }>}
 *
 * @example
 * const { validateEmail } = require('mailgate');
 * const result = await validateEmail('user@mailinator.com');
 * // result.action === 'BLOCK'
 */
async function validateEmail(email) {
  if (!email || typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH) {
    return {
      isValid: false,
      score: 100,
      action: 'BLOCK',
      reason: 'Empty, invalid, or oversized input',
      details: {},
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!validator.isEmail(cleanEmail)) {
    return {
      isValid: false,
      score: 100,
      action: 'BLOCK',
      reason: 'Invalid email syntax (RFC 5322)',
      details: {},
    };
  }

  const atIdx = cleanEmail.indexOf('@');
  const localPart = cleanEmail.slice(0, atIdx);
  const domain = cleanEmail.slice(atIdx + 1);
  const isPlusAlias = localPart.includes('+');
  const baseLocal = isPlusAlias ? localPart.split('+')[0] : localPart;

  const isHighRiskTld = HIGH_RISK_TLDS.some((tld) => domain.endsWith(tld));

  let isDisposable =
    disposableSet.has(domain) ||
    hasSuspiciousDomainLabel(domain) || // label-only match, not substring
    isHighRiskTld;

  const typoCheck = detectTypoDomain(domain); // skips FREE_WEBMAIL_DOMAINS safely
  const isGibberish = isGibberishUsername(baseLocal);
  const isRole = ROLE_USERNAMES.has(baseLocal);
  const isFreeWebmail = FREE_WEBMAIL_DOMAINS.has(domain);

  let hasMxRecords = true,
    mxError = null,
    isTempMxHost = false,
    isParkedDomain = false,
    mxHosts = [];

  try {
    const mxRecords = await resolveMxWithTimeout(domain);
    hasMxRecords = Array.isArray(mxRecords) && mxRecords.length > 0;
    if (hasMxRecords) {
      mxHosts = mxRecords.map((r) => r.exchange.toLowerCase());
      isTempMxHost = mxHosts.some((h) => TEMP_MX_HOST_PATTERNS.some((p) => h.includes(p)));
      isParkedDomain = mxHosts.some((h) => PARKED_MX_HOST_PATTERNS.some((p) => h.includes(p)));
      if (isTempMxHost) {
        isDisposable = true;
      }
    }
  } catch {
    // Known free webmail providers treated as live to handle transient DNS failures
    hasMxRecords = isFreeWebmail;
    if (!isFreeWebmail && !isDisposable) {
      mxError = 'No active MX records found';
    }
  }

  let score = 0;
  const reasons = [];

  if (isDisposable) {
    score += 90;
    reasons.push('Disposable or temporary email provider');
  }
  if (typoCheck.isTypo) {
    score += 90;
    reasons.push(`Typo-squatted domain (target: ${typoCheck.targetDomain})`);
  }
  if (isGibberish) {
    score += 65;
    reasons.push('Random or bot-generated username pattern');
  }
  if (isParkedDomain && !isDisposable) {
    score += 80;
    reasons.push('MX record points to domain parking service');
  }
  if (isTempMxHost && !isDisposable) {
    score += 90;
    reasons.push('MX record points to disposable mail infrastructure');
  }
  if (!hasMxRecords && !isFreeWebmail) {
    score += 90;
    reasons.push('No active MX records found');
  }
  if (isRole) {
    score += 25;
    reasons.push('Role-based address (non-personal)');
  }
  // ponytail: plus-alias not scored: user+tag@gmail.com is valid usage

  score = Math.min(score, 100);

  const action = score >= THRESHOLDS.BLOCK ? 'BLOCK' : score >= THRESHOLDS.FLAG ? 'FLAG' : 'ALLOW';
  const isValid =
    score < THRESHOLDS.BLOCK &&
    !isDisposable &&
    !typoCheck.isTypo &&
    hasMxRecords &&
    !isParkedDomain;

  return {
    email: cleanEmail,
    isValid,
    score,
    action,
    reason: reasons.length > 0 ? reasons.join('; ') : 'Valid email',
    details: {
      isDisposable,
      isTypoDomain: typoCheck.isTypo,
      typoTarget: typoCheck.targetDomain,
      isGibberish,
      isParkedDomain,
      isHighRiskTld,
      isRole,
      isFreeWebmail,
      isPlusAlias,
      hasMxRecords,
      domain,
      mxHosts,
      mxError,
    },
  };
}

module.exports = { validateEmail };
