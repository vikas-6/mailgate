#!/usr/bin/env node
const { validateEmail } = require('../src/validator');

const email = process.argv[2];

if (!email) {
  console.error('Usage: mailgate <email>');
  console.error('Example: mailgate user@mailinator.com');
  process.exit(1);
}

validateEmail(email).then(result => {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.isValid ? 0 : 1);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
