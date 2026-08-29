---
name: Bug Report
about: Report a bug or unexpected behaviour in mailgate
title: 'fix: <brief description>'
labels: ['bug', 'needs-triage']
assignees: ''
---

## Bug Description

<!-- A clear and concise description of what the bug is. -->

## Steps to Reproduce

```js
// Minimal reproduction code
const { validateEmail } = require('mailgate');
const result = await validateEmail('...');
console.log(result);
```

## Expected Behaviour

<!-- What should have happened? -->

## Actual Behaviour

<!-- What actually happened? Paste error messages, stack traces, or unexpected output. -->

## Environment

| Item             | Version                              |
| ---------------- | ------------------------------------ |
| mailgate         | <!-- e.g. 1.1.0 -->                  |
| Node.js          | <!-- node --version -->              |
| Operating System | <!-- e.g. macOS 14, Ubuntu 22.04 --> |

## Additional Context

<!-- Any other context, screenshots, or related issues. -->
