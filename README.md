# mailgate

> Fast, offline-first email validation and fraud detection for Node.js

[![Website](https://img.shields.io/badge/Website-mailgate.netlify.app-00C7B7?style=flat&logo=netlify)](https://mailgate.netlify.app/)
[![npm](https://img.shields.io/npm/v/mailgate.svg)](https://www.npmjs.com/package/mailgate)
[![npm downloads](https://img.shields.io/npm/dt/mailgate.svg)](https://www.npmjs.com/package/mailgate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/node/v/mailgate.svg)](https://nodejs.org)

MailGate detects disposable, fake, and fraudulent email addresses using a bundled database of **8,400+ blocked domains** combined with live DNS/MX checks, typo-squatting detection, and bot username analysis in under **1ms** with zero external API calls.

## Install

```sh
npm install mailgate
```

Requires Node.js 16 or higher.

## Usage

```js
const { validateEmail } = require('mailgate');

const result = await validateEmail('user@mailinator.com');

console.log(result.isValid); // false
console.log(result.action);  // 'BLOCK'
console.log(result.score);   // 90
console.log(result.reason);  // 'Disposable or temporary email provider'
```

## API

### `validateEmail(email)`

Returns a `Promise` that resolves with a validation result object.

| Parameter | Type     | Description                  |
| --------- | -------- | ---------------------------- |
| `email`   | `string` | The email address to inspect |

#### Result Object

```js
{
  email:   string,               // Normalized email
  isValid: boolean,              // false if the email should be rejected
  score:   number,               // Risk score from 0 (safe) to 100 (fraud)
  action:  'ALLOW'|'FLAG'|'BLOCK',
  reason:  string,               // Description of the highest-risk factor(s)
  details: {
    isDisposable:   boolean,     // Matched known disposable provider
    isTypoDomain:   boolean,     // Looks like a typo of a major domain
    typoTarget:     string|null, // Suggested correct domain, e.g. 'gmail.com'
    isGibberish:    boolean,     // Random/bot-generated username detected
    isParkedDomain: boolean,     // MX points to a domain parking service
    isHighRiskTld:  boolean,     // High-abuse TLD (.tk, .ml, .cf, etc.)
    isRole:         boolean,     // Role address: admin@, noreply@, billing@
    isFreeWebmail:  boolean,     // Known consumer webmail provider
    isPlusAlias:    boolean,     // Contains sub-addressing tag (+)
    hasMxRecords:   boolean,     // Domain has active mail servers
    domain:         string,
    mxHosts:        string[],
    mxError:        string|null
  }
}
```

#### Action values

| Value   | Score range | What to do                                              |
| ------- | ----------- | ------------------------------------------------------- |
| `ALLOW` | 0 - 34      | Accept the email                                        |
| `FLAG`  | 35 - 69     | Require additional verification (OTP, CAPTCHA)          |
| `BLOCK` | 70 - 100    | Reject registration                                     |

## Examples

### Express signup route

```js
const express = require('express');
const { validateEmail } = require('mailgate');

const app = express();
app.use(express.json());

app.post('/register', async (req, res) => {
  const check = await validateEmail(req.body.email);

  if (check.action === 'BLOCK') {
    return res.status(400).json({ error: check.reason });
  }

  if (check.action === 'FLAG') {
    return res.status(202).json({ verificationRequired: true });
  }

  // proceed with account creation...
  res.json({ success: true });
});
```

### Full response example

```js
await validateEmail('user@mailinator.com');

// {
//   email: 'user@mailinator.com',
//   isValid: false,
//   score: 90,
//   action: 'BLOCK',
//   reason: 'Disposable or temporary email provider',
//   details: {
//     isDisposable: true,
//     isTypoDomain: false,
//     typoTarget: null,
//     isGibberish: false,
//     isParkedDomain: false,
//     isHighRiskTld: false,
//     isRole: false,
//     isFreeWebmail: false,
//     isPlusAlias: false,
//     hasMxRecords: true,
//     domain: 'mailinator.com',
//     mxHosts: [ 'mail.mailinator.com', 'mail2.mailinator.com' ],
//     mxError: null
//   }
// }
```

## CLI

```sh
# run without installing
npx mailgate user@mailinator.com

# or install globally
npm install -g mailgate
mailgate user@gmail.com
```

Exits `0` if valid, `1` if blocked. Suitable for use in shell scripts and CI pipelines.

## Website

Official website and documentation: **[https://mailgate.netlify.app/](https://mailgate.netlify.app/)**

## Self-hosted server

```sh
git clone https://github.com/vikas-6/mailgate
cd mailgate && npm install && npm start
# → http://localhost:3000
```

| Method | Endpoint                              | Description              |
| ------ | ------------------------------------- | ------------------------ |
| GET    | `/health`                             | Server health check      |
| POST   | `/api/v1/verify`                      | Full inspection (JSON body `{ email }`) |
| GET    | `/api/v1/check-email?email=...`       | Quick GET validation     |

Rate limit: 60 requests / minute per IP. No authentication required.

## License

[MIT](./LICENSE) © [vikas-6](https://github.com/vikas-6)
