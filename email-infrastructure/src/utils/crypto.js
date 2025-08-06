import crypto from 'crypto';

export function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}