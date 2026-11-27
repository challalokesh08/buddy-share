'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DATA_FILE } = require('./config');

const EMPTY = () => ({
  users: [],
  otps: [],
  sessions: [],
  requests: [],
  offers: [],
  rentals: [],
  notifications: [],
  transactions: [],
  pushTokens: [],
});

let db;

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    db = { ...EMPTY(), ...parsed };
  } catch {
    db = EMPTY();
    persistSync();
  }
}

let timer = null;
function persistSync() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function save() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    persistSync();
  }, 120);
}

function getDb() {
  if (!db) load();
  return db;
}

function uid(prefix = '') {
  return prefix + require('node:crypto').randomUUID();
}

function now() {
  return new Date().toISOString();
}

load();

module.exports = { getDb, save, uid, now, persistSync };
