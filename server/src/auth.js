'use strict';

const crypto = require('node:crypto');
const { getDb, save, uid, now } = require('./store');
const { collegeFromEmail, OTP_TTL_MS, SESSION_TTL_MS } = require('./config');

function requestOtp(email) {
  const college = collegeFromEmail(email);
  if (!college) {
    throw Object.assign(
      new Error('Please use your college email address. Allowed domains: ' + require('./config').COLLEGE_DOMAINS.join(', ')),
      { status: 400 }
    );
  }
  const normalized = email.trim().toLowerCase();
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const db = getDb();
  db.otps = db.otps.filter((o) => o.email !== normalized);
  db.otps.push({ email: normalized, code: otp, expiresAt: Date.now() + OTP_TTL_MS });
  save();
  return { email: normalized, college, devOtp: otp };
}

function verifyOtp(email, code) {
  const normalized = String(email || '').trim().toLowerCase();
  const db = getDb();
  const record = db.otps.find((o) => o.email === normalized && o.code === String(code));
  if (!record) throw Object.assign(new Error('Incorrect OTP'), { status: 400 });
  if (record.expiresAt < Date.now()) {
    db.otps = db.otps.filter((o) => o !== record);
    save();
    throw Object.assign(new Error('OTP expired. Please request a new one'), { status: 400 });
  }
  db.otps = db.otps.filter((o) => o !== record);

  const college = collegeFromEmail(normalized);
  let user = db.users.find((u) => u.email === normalized);
  if (!user) {
    const localPart = normalized.split('@')[0].split(/[._-]/).filter(Boolean);
    user = {
      id: uid('usr_'),
      email: normalized,
      name: localPart.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'Student',
      collegeKey: college.collegeKey,
      collegeDomain: college.domain,
      collegeName: college.collegeName,
      avatarColor: ['#6366F1', '#14B8A6', '#F59E0B', '#EC4899', '#3B82F6'][db.users.length % 5],
      walletPaise: 0,
      pushToken: null,
      createdAt: now(),
    };
    db.users.push(user);
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions.push({ token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS, createdAt: now() });
  save();
  return { token, user };
}

function userFromToken(token) {
  if (!token) return null;
  const db = getDb();
  const session = db.sessions.find((s) => s.token === token && s.expiresAt > Date.now());
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Not authenticated. Please sign in again.' });
  req.user = user;
  req.token = token;
  next();
}

function logout(token) {
  const db = getDb();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  save();
}

module.exports = { requestOtp, verifyOtp, userFromToken, requireAuth, logout };
