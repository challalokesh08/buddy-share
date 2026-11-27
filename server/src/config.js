'use strict';

const path = require('node:path');

// Comma-separated list of exact allowed domains and/or suffixes.
// Only Cambridge Institute of Technology students may sign up.
const rawDomains = process.env.COLLEGE_DOMAINS || 'cambridge.edu.in';
const COLLEGE_DOMAINS = rawDomains
  .split(',')
  .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function collegeFromEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  const domain = normalized.split('@')[1];
  const exact = COLLEGE_DOMAINS.find((d) => d === domain);
  const suffix = COLLEGE_DOMAINS.find((d) => d.startsWith('.') && domain.endsWith(d));
  if (!exact && !suffix) return null;
  // Group by the full domain, so iitb.ac.in and vit.ac.in are separate colleges.
  return {
    domain,
    collegeKey: domain,
    collegeName: domain.split('.')[0].toUpperCase(),
  };
}

module.exports = {
  PORT,
  DATA_FILE,
  COLLEGE_DOMAINS,
  OTP_TTL_MS,
  SESSION_TTL_MS,
  collegeFromEmail,
};
