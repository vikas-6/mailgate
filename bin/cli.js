#!/usr/bin/env node
const { validateEmail } = require('../src/validator');

const email = process.argv[2];

if (!email) {
  // eslint-disable-next-line no-console
  console.error('Usage: mailgate <email>');
  // eslint-disable-next-line no-console
  console.error('Example: mailgate user@mailinator.com');
  process.exit(1);
}

validateEmail(email)
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.isValid ? 0 : 1);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Error:', err.message);
    process.exit(1);
  });
