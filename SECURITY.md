# Security Policy

## Supported Versions

| Version | Supported         |
| ------- | ----------------- |
| 1.1.x   | ✅ Active support |
| 1.0.x   | ✅ Security fixes |
| < 1.0   | ❌ Not supported  |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

Instead, use one of the following channels:

### GitHub Private Security Advisory (preferred)

1. Go to the [Security tab](https://github.com/vikas-6/mailgate/security/advisories/new)
2. Click **"New draft security advisory"**
3. Fill in the details and submit

This creates a private thread visible only to you and the maintainers.

### Email

Send a detailed report to the maintainer. You can find contact information in the [GitHub profile](https://github.com/vikas-6).

---

## What to Include in Your Report

To help us triage quickly, please include:

- **Description** of the vulnerability and its potential impact
- **Steps to reproduce** (proof-of-concept code if possible)
- **Affected versions**
- **Suggested fix** (optional but appreciated)

---

## Response Timeline

| Stage                           | Target SLA                |
| ------------------------------- | ------------------------- |
| Initial acknowledgement         | 48 hours                  |
| Severity assessment             | 5 days                    |
| Fix development                 | 14 days                   |
| Public disclosure (after patch) | Coordinated with reporter |

We follow responsible disclosure — we will work with you to ensure a fix is in place before any public disclosure.

---

## Scope

The following are **in scope** for security reports:

- Remote code execution via the `validateEmail()` function
- Regular expression denial-of-service (ReDoS)
- Dependency vulnerabilities with a direct exploit path
- Authentication/authorisation bypass in the optional HTTP server

The following are **out of scope**:

- Theoretical vulnerabilities without a realistic exploit
- Issues in dependencies that are not exploitable via this package's API
- Social engineering attacks

---

## Disclosure Policy

Once a fix is released, we will:

1. Publish a GitHub Security Advisory
2. Credit the reporter (unless they prefer to remain anonymous)
3. Publish a patch release following semver

Thank you for helping keep **mailgate** and its users safe. 🔐
