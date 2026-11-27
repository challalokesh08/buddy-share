'use strict';

const { WebSocketServer } = require('ws');
const { getDb, save, uid, now } = require('./store');
const { userFromToken } = require('./auth');

const sockets = new Map(); // userId -> Set<ws>

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    let token;
    try {
      token = new URL(req.url, 'http://localhost').searchParams.get('token');
    } catch {
      token = null;
    }
    const user = userFromToken(token);
    if (!user) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    if (!sockets.has(user.id)) sockets.set(user.id, new Set());
    sockets.get(user.id).add(ws);
    ws.userId = user.id;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', at: now() }));
      } catch { /* ignore malformed client messages */ }
    });
    ws.on('close', () => {
      sockets.get(user.id)?.delete(ws);
      if (sockets.get(user.id)?.size === 0) sockets.delete(user.id);
    });
    ws.send(JSON.stringify({ type: 'connected', at: now() }));
  });

  const heartbeat = setInterval(() => {
    for (const set of sockets.values()) {
      for (const ws of set) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 30000);
  heartbeat.unref();
  return wss;
}

function deliver(userId, payload) {
  const set = sockets.get(userId);
  if (!set) return;
  const message = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(message);
  }
}

function notify({ userId, type, title, body, data = {} }) {
  if (!userId) return;
  const db = getDb();
  const notification = {
    id: uid('ntf_'),
    userId,
    type,
    title,
    body,
    data,
    read: false,
    createdAt: now(),
  };
  db.notifications.unshift(notification);
  if (db.notifications.length > 300) db.notifications.length = 300;
  save();
  deliver(userId, { type: 'notification', data: notification });
  sendPush(userId, notification);
  return notification;
}

// Expo push is optional: without EXPO_ACCESS_TOKEN the app still gets
// realtime in-app notifications over the socket.
async function sendPush(userId, notification) {
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user?.pushToken) return;
  const token = process.env.EXPO_ACCESS_TOKEN;
  if (!token) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: user.pushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        channelId: 'buddy-share-default',
      }),
    });
  } catch (err) {
    console.warn('[push] failed:', err.message);
  }
}

function broadcastToCollege(collegeKey, event, data, excludeUserId) {
  const db = getDb();
  for (const user of db.users) {
    if (user.collegeKey !== collegeKey || user.id === excludeUserId) continue;
    deliver(user.id, { type: event, data });
  }
}

module.exports = { attach, deliver, notify, broadcastToCollege };
