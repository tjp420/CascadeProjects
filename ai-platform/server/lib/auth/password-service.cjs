// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
'use strict';

const bcrypt = require('bcryptjs');

async function hashPassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new TypeError('hashPassword requires a non-empty string password');
  }
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hashedPassword) {
  if (typeof password !== 'string' || typeof hashedPassword !== 'string') {
    throw new TypeError('verifyPassword requires string arguments');
  }
  return await bcrypt.compare(password, hashedPassword);
}

module.exports = { hashPassword, verifyPassword };
