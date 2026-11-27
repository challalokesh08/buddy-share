/**
 * On-device backend for the standalone demo APK.
 * Implements the same routes as server/src/routes.js, persists to AsyncStorage,
 * and simulates Cambridge classmates so the entire 50/50 flow works offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from './errors';
import type { AppNotification, BorrowRequest, Offer, Rental, Transaction, User } from './types';

const STORAGE_KEY = 'buddy.localDb.v1';
const COLLEGE_KEY = 'cambridge.edu.in';
const COLLEGE_NAME = 'CAMBRIDGE';

type LDb = {
  users: any[];
  otps: any[];
  sessions: any[];
  requests: BorrowRequest[];
  offers: Offer[];
  rentals: Rental[];
  notifications: AppNotification[];
  transactions: Transaction[];
};

type Listener = (message: any) => void;
const listeners = new Map<string, Set<Listener>>();
const scheduled = new Set<string>();

export function subscribeLocal(userId: string, listener: Listener) {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId)!.add(listener);
  return () => { listeners.get(userId)?.delete(listener); };
}

function deliver(userId: string | undefined, message: any) {
  if (!userId) return;
  listeners.get(userId)?.forEach((fn) => fn(message));
}

function uid(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function empty(): LDb {
  return { users: [], otps: [], sessions: [], requests: [], offers: [], rentals: [], notifications: [], transactions: [] };
}

let state: LDb | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (!state) return;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 120);
}

function seed(d: LDb) {
  if (!d.users.some((u) => u.id === 'demo_rohan')) {
    [
      { id: 'demo_rohan', name: 'Rohan Sharma', email: 'rohan@cambridge.edu.in', avatarColor: '#0284C7', walletPaise: 50000 },
      { id: 'demo_ananya', name: 'Ananya Iyer', email: 'ananya@cambridge.edu.in', avatarColor: '#E11D48', walletPaise: 40000 },
      { id: 'demo_vikram', name: 'Vikram Rao', email: 'vikram@cambridge.edu.in', avatarColor: '#7C3AED', walletPaise: 45000 },
    ].forEach((u, i) => d.users.push({
      ...u,
      collegeKey: COLLEGE_KEY,
      collegeDomain: COLLEGE_KEY,
      collegeName: COLLEGE_NAME,
      createdAt: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
      pushToken: null,
      isDemo: true,
    }));
  }
  const now = Date.now();
  if (!d.requests.some((r) => r.id === 'demo_req_bike')) {
    d.requests.push({
      id: 'demo_req_bike', userId: 'demo_rohan', userName: 'Rohan Sharma', userAvatarColor: '#0284C7',
      collegeKey: COLLEGE_KEY, item: 'Cycle / Bike', note: 'For a ride around the campus in the evening',
      hours: 3, category: 'Sports', status: 'open', createdAt: new Date(now - 3600000).toISOString(),
    });
  }
  if (!d.requests.some((r) => r.id === 'demo_req_calc')) {
    d.requests.push({
      id: 'demo_req_calc', userId: 'demo_ananya', userName: 'Ananya Iyer', userAvatarColor: '#E11D48',
      collegeKey: COLLEGE_KEY, item: 'Scientific calculator', note: 'Need it for a quiz, will return the same day',
      hours: 2, category: 'Electronics', status: 'open', createdAt: new Date(now - 7200000).toISOString(),
    });
  }
}

async function db(): Promise<LDb> {
  if (state) return state;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    state = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    state = empty();
  }
  seed(state!);
  persist();
  return state!;
}

function fail(message: string, status = 400): never {
  throw new ApiError(message, status);
}

function publicUser(u: any) {
  return {
    id: u.id, name: u.name, email: u.email, collegeName: u.collegeName,
    collegeDomain: u.collegeDomain, avatarColor: u.avatarColor, createdAt: u.createdAt,
  };
}

function me(d: LDb, token?: string | null) {
  const session = d.sessions.find((s) => s.token === token);
  if (!session) fail('Not authenticated. Please sign in again.', 401);
  const user = d.users.find((u) => u.id === session.userId);
  if (!user) fail('Not authenticated. Please sign in again.', 401);
  return user;
}

function requestView(d: LDb, r: BorrowRequest, meId: string) {
  const offers = d.offers.filter((o) => o.requestId === r.id);
  return {
    ...r,
    isMine: r.userId === meId,
    offerCount: offers.length,
    myOffer: offers.find((o) => o.ownerId === meId) || null,
  };
}

function rentalView(d: LDb, r: Rental, meId: string) {
  const counterparty = d.users.find((u) => u.id === (r.borrowerId === meId ? r.ownerId : r.borrowerId));
  return {
    ...r,
    role: r.borrowerId === meId ? 'borrower' : 'owner',
    totalPaise: r.agreedPricePaise * r.hours,
    counterparty: counterparty ? publicUser(counterparty) : { id: '', name: 'Student', email: '', collegeName: '', collegeDomain: '', avatarColor: '#6366F1', createdAt: '' },
  };
}

function ledger(d: LDb, entry: Omit<Transaction, 'id' | 'createdAt'>) {
  d.transactions.unshift({ ...entry, id: uid('txn_'), createdAt: new Date().toISOString() });
}

function holdPayment(d: LDb, rental: Rental) {
  const half = Math.round(rental.agreedPricePaise * rental.hours / 2);
  const borrower = d.users.find((u) => u.id === rental.borrowerId)!;
  if (borrower.walletPaise < half) fail(`Insufficient wallet balance. Need ₹${(half / 100).toFixed(2)}`, 402);
  borrower.walletPaise -= half;
  rental.firstPaymentPaise = half;
  rental.escrowPaise = half;
  ledger(d, { userId: borrower.id, type: 'hold', amountPaise: half, rentalId: rental.id, counterpartyId: rental.ownerId, note: 'Advance rent (50%) held in escrow' });
}

function releasePayment(d: LDb, rental: Rental) {
  const total = rental.agreedPricePaise * rental.hours;
  const rest = total - (rental.firstPaymentPaise || 0);
  const borrower = d.users.find((u) => u.id === rental.borrowerId)!;
  if (borrower.walletPaise < rest) fail(`Insufficient wallet balance. Need ₹${(rest / 100).toFixed(2)}`, 402);
  borrower.walletPaise -= rest;
  rental.secondPaymentPaise = rest;
  rental.escrowPaise = total;
  ledger(d, { userId: borrower.id, type: 'hold', amountPaise: rest, rentalId: rental.id, counterpartyId: rental.ownerId, note: 'Balance rent (50%) held in escrow' });
}

function payoutPayment(d: LDb, rental: Rental) {
  const total = rental.agreedPricePaise * rental.hours;
  const owner = d.users.find((u) => u.id === rental.ownerId)!;
  owner.walletPaise += total;
  rental.escrowPaise = 0;
  rental.paidOutPaise = total;
  ledger(d, { userId: owner.id, type: 'release', amountPaise: total, rentalId: rental.id, counterpartyId: rental.borrowerId, note: 'Rent released after return' });
}

function refundPayment(d: LDb, rental: Rental) {
  if (!rental.firstPaymentPaise) return;
  const borrower = d.users.find((u) => u.id === rental.borrowerId)!;
  borrower.walletPaise += rental.firstPaymentPaise;
  rental.refundedPaise = rental.firstPaymentPaise;
  rental.escrowPaise = 0;
  ledger(d, { userId: borrower.id, type: 'refund', amountPaise: rental.refundedPaise, rentalId: rental.id, counterpartyId: rental.ownerId, note: 'Rental cancelled — advance refunded' });
}

function notify(d: LDb, userId: string, type: string, title: string, body: string, data: any = {}) {
  const note: AppNotification = { id: uid('ntf_'), userId, type, title, body, data, read: false, createdAt: new Date().toISOString() };
  d.notifications.unshift(note);
  if (d.notifications.length > 300) d.notifications.length = 300;
  deliver(userId, { type: 'notification', data: note });
}

function scheduleOnce(key: string, delay: number, fn: () => void | Promise<void | boolean>) {
  if (scheduled.has(key)) return;
  scheduled.add(key);
  setTimeout(async () => {
    try {
      // Returning false means "not ready yet" — let a later action re-arm this timer.
      if (await fn() === false) scheduled.delete(key);
    } catch {
      scheduled.delete(key);
    }
  }, delay);
}

const PRICE_BY_CATEGORY: Record<string, number> = {
  Electronics: 55, Sports: 70, Books: 20, Tools: 45, Kitchen: 35, Other: 40,
};

function schedulePeerOffers(requestId: string, delay = 2200) {
  scheduleOnce(`offer1:${requestId}`, delay, async () => {
    const d = await db();
    const r = d.requests.find((x) => x.id === requestId);
    if (!r || r.status !== 'open') return false;
    const demos = d.users.filter((u) => u.isDemo);
    const pool = demos.filter((u) => u.id !== r.userId);
    for (const owner of pool.slice(0, 2)) {
      if (d.offers.some((o) => o.requestId === requestId && o.ownerId === owner.id)) continue;
      const price = (PRICE_BY_CATEGORY[r.category] || 50) + Math.floor(Math.random() * 25);
      const offer: Offer = {
        id: uid('ofr_'), requestId, ownerId: owner.id, ownerName: owner.name,
        ownerAvatarColor: owner.avatarColor, pricePerHourPaise: price * 100,
        message: owner.id === 'demo_rohan' ? 'Available near the library, in great condition' :
          owner.id === 'demo_ananya' ? 'Happy to hand it over at the hostel gate' : 'Can meet at the campus canteen',
        status: 'pending', createdAt: new Date().toISOString(),
      };
      d.offers.unshift(offer);
      save();
      notify(d, r.userId, 'offer:new', 'New offer for your request', `${owner.name} quoted ₹${price}/hour for ${r.item}`, { requestId, offerId: offer.id });
      deliver(r.userId, { type: 'offer:new', data: { requestId, offer } });
      break;
    }
  });
  scheduleOnce(`offer2:${requestId}`, delay + 4200, async () => {
    const d = await db();
    const r = d.requests.find((x) => x.id === requestId);
    if (!r || r.status !== 'open') return false;
    const already = new Set(d.offers.filter((o) => o.requestId === requestId).map((o) => o.ownerId));
    const owner = d.users.find((u) => u.isDemo && u.id !== r.userId && !already.has(u.id));
    if (!owner) return;
    const price = (PRICE_BY_CATEGORY[r.category] || 50) + Math.floor(Math.random() * 25);
    const offer: Offer = {
      id: uid('ofr_'), requestId, ownerId: owner.id, ownerName: owner.name,
      ownerAvatarColor: owner.avatarColor, pricePerHourPaise: price * 100,
      message: 'I have one too — flexible on timing', status: 'pending', createdAt: new Date().toISOString(),
    };
    d.offers.unshift(offer);
    save();
    notify(d, r.userId, 'offer:new', 'Another offer came in', `${owner.name} quoted ₹${price}/hour for ${r.item}`, { requestId, offerId: offer.id });
    deliver(r.userId, { type: 'offer:new', data: { requestId, offer } });
  });
}

function scheduleDemoBorrowerPayments(rentalId: string) {
  scheduleOnce(`demoAdvance:${rentalId}`, 3500, async () => {
    const d = await db();
    const r = d.rentals.find((x) => x.id === rentalId);
    if (!r || r.status !== 'accepted') return false;
    holdPayment(d, r);
    r.status = 'active';
    r.timeline.push({ status: 'active', at: new Date().toISOString(), note: `Advance of ₹${(r.firstPaymentPaise / 100).toFixed(2)} paid and held in escrow` });
    save();
    notify(d, r.ownerId, 'rental:updated', 'Advance received 💰', `₹${(r.firstPaymentPaise / 100).toFixed(2)} is in escrow. Please hand over the ${r.item}.`, { rentalId });
    deliver(r.ownerId, { type: 'rental:updated', data: rentalView(d, r, r.ownerId) });
    deliver(r.ownerId, { type: 'wallet:updated', data: { walletPaise: d.users.find((u) => u.id === r.ownerId)!.walletPaise } });
  });
  scheduleOnce(`demoBalance:${rentalId}`, 8000, async () => {
    const d = await db();
    const r = d.rentals.find((x) => x.id === rentalId);
    if (!r || r.status !== 'active') return false;
    releasePayment(d, r);
    r.status = 'return_paid';
    r.timeline.push({ status: 'return_paid', at: new Date().toISOString(), note: 'Balance paid. Awaiting owner confirmation' });
    save();
    notify(d, r.ownerId, 'rental:updated', 'Balance received ✅', `Please confirm the ${r.item} was returned.`, { rentalId });
    deliver(r.ownerId, { type: 'rental:updated', data: rentalView(d, r, r.ownerId) });
  });
}

function scheduleDemoOwnerConfirm(rentalId: string) {
  scheduleOnce(`demoConfirm:${rentalId}`, 4500, async () => {
    const d = await db();
    const r = d.rentals.find((x) => x.id === rentalId);
    if (!r || r.status !== 'return_paid') return false;
    payoutPayment(d, r);
    r.status = 'completed';
    r.timeline.push({ status: 'completed', at: new Date().toISOString(), note: 'Returned. Rent released to owner' });
    save();
    notify(d, r.borrowerId, 'rental:updated', 'Rental completed 🎉', `The ${r.item} rental is all settled.`, { rentalId });
    deliver(r.borrowerId, { type: 'rental:updated', data: rentalView(d, r, r.borrowerId) });
  });
}

function scheduleDemoAccept(offerId: string, delay = 4000) {
  scheduleOnce(`demoAccept:${offerId}`, delay, async () => {
    const d = await db();
    const offer = d.offers.find((o) => o.id === offerId);
    if (!offer || offer.status !== 'pending') return false;
    const request = d.requests.find((r) => r.id === offer.requestId);
    if (!request || request.status !== 'open') return false;
    offer.status = 'accepted';
    d.offers.filter((o) => o.requestId === request.id && o.id !== offer.id).forEach((o) => { o.status = 'declined'; });
    request.status = 'matched';
    const rental: Rental = {
      id: uid('rnt_'), requestId: request.id, offerId: offer.id,
      borrowerId: request.userId, ownerId: offer.ownerId, item: request.item, hours: request.hours,
      agreedPricePaise: offer.pricePerHourPaise, status: 'accepted',
      firstPaymentPaise: 0, secondPaymentPaise: 0, escrowPaise: 0, paidOutPaise: 0,
      createdAt: new Date().toISOString(),
      timeline: [{ status: 'accepted', at: new Date().toISOString(), note: `${request.userName} accepted your quote` }],
    };
    d.rentals.unshift(rental);
    save();
    notify(d, offer.ownerId, 'offer:accepted', 'Your offer was accepted! 🎉', `${request.userName} picked your quote for ${request.item}`, { rentalId: rental.id, requestId: request.id });
    deliver(offer.ownerId, { type: 'rental:new', data: rentalView(d, rental, offer.ownerId) });
    scheduleDemoBorrowerPayments(rental.id);
  });
}

/** Wipe generated demo activity but keep the signed-in account. */
export async function resetLocalData() {
  const prev = await db();
  const fresh = empty();
  fresh.users = prev.users.filter((u) => !u.isDemo);
  fresh.sessions = prev.sessions;
  seed(fresh);
  state = fresh;
  scheduled.clear();
  await persist();
}

/** Re-arm timers for anything left pending after an app restart. */
export function kickLocalEngine() {
  scheduleOnce('engine:kick', 600, async () => {
    const d = await db();
    d.requests.filter((r) => r.status === 'open' && !r.userId.startsWith('demo_')).forEach((r) => schedulePeerOffers(r.id, 1500));
    d.offers.filter((o) => o.status === 'pending' && o.ownerId && !o.ownerId.startsWith('demo_')).forEach((o) => scheduleDemoAccept(o.id, 2500));
    d.rentals.filter((r) => r.status === 'accepted' && r.borrowerId.startsWith('demo_')).forEach((r) => scheduleDemoBorrowerPayments(r.id));
    d.rentals.filter((r) => r.status === 'return_paid' && !r.borrowerId.startsWith('demo_')).forEach((r) => scheduleDemoOwnerConfirm(r.id));
  });
}

export async function localApi(path: string, options: { method?: string; body?: any; token?: string | null } = {}): Promise<any> {
  const d = await db();
  const method = options.method || 'GET';
  const body = options.body || {};
  const token = options.token;
  const isPublic = path.startsWith('/auth/') || path === '/health' || path === '/config';
  const user = isPublic ? null : me(d, token);
  const myId = user?.id;

  if (path === '/health' || path === '/config') return { ok: true, collegeDomains: [COLLEGE_KEY] };

  if (path === '/auth/request-otp' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@cambridge\.edu\.in$/.test(email)) {
      fail('Use your Cambridge Institute of Technology email address (@cambridge.edu.in)');
    }
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    d.otps = d.otps.filter((o: any) => o.email !== email);
    d.otps.push({ email, code });
    save();
    return { ok: true, email, collegeName: COLLEGE_NAME, devOtp: code };
  }

  if (path === '/auth/verify-otp' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@cambridge\.edu\.in$/.test(email)) fail('Use your @cambridge.edu.in address');
    const code = String(body.code || '').trim();
    if (code.length !== 6) fail('Enter the 6-digit code shown on screen');
    let u = d.users.find((x) => x.email === email);
    if (!u) {
      const parts = email.split('@')[0].split(/[._-]/).filter(Boolean);
      u = {
        id: uid('usr_'), email, name: parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'Student',
        collegeKey: COLLEGE_KEY, collegeDomain: COLLEGE_KEY, collegeName: COLLEGE_NAME,
        avatarColor: ['#4F46E5', '#14B8A6', '#F59E0B', '#EC4899', '#3B82F6'][d.users.length % 5],
        walletPaise: 0, pushToken: null, createdAt: new Date().toISOString(),
      };
      d.users.push(u);
    }
    const sessionToken = uid('sess_');
    d.sessions.push({ token: sessionToken, userId: u.id });
    save();
    return { token: sessionToken, user: publicUser(u) };
  }

  if (path === '/auth/logout' && method === 'POST') {
    d.sessions = d.sessions.filter((s: any) => s.token !== token);
    save();
    return { ok: true };
  }

  if (path === '/me' && method === 'GET') return { user: publicUser(user), walletPaise: user.walletPaise || 0 };

  if (path === '/notifications/push-token' && method === 'POST') {
    user.pushToken = String(body.token || '');
    save();
    return { ok: true };
  }

  if (path === '/notifications' && method === 'GET') {
    return { notifications: d.notifications.filter((n) => n.userId === myId).slice(0, 60) };
  }

  if (path === '/notifications/read' && method === 'POST') {
    d.notifications.filter((n) => n.userId === myId && (!body.id || n.id === body.id)).forEach((n) => { n.read = true; });
    save();
    return { ok: true };
  }

  if (path === '/requests' && method === 'POST') {
    const item = String(body.item || '').trim();
    const hours = Number(body.hours);
    if (!item) fail('Tell us what you need');
    if (!Number.isFinite(hours) || hours <= 0 || hours > 720) fail('Duration must be between 1 minute and 30 days');
    const request: BorrowRequest = {
      id: uid('req_'), userId: myId!, userName: user.name, userAvatarColor: user.avatarColor,
      collegeKey: COLLEGE_KEY, item, note: String(body.note || '').trim(), hours,
      category: String(body.category || 'Other'), status: 'open', createdAt: new Date().toISOString(),
    };
    d.requests.unshift(request);
    save();
    schedulePeerOffers(request.id);
    return { request: requestView(d, request, myId!) };
  }

  if (path === '/requests' && method === 'GET') {
    return { requests: d.requests.slice(0, 100).map((r) => requestView(d, r, myId!)) };
  }

  let match = path.match(/^\/requests\/([^/]+)$/);
  if (match && method === 'GET') {
    const request = d.requests.find((r) => r.id === match![1]);
    if (!request) fail('Request not found', 404);
    const offersAll = d.offers.filter((o) => o.requestId === request.id);
    const canSee = request.userId === myId || offersAll.some((o) => o.ownerId === myId);
    return {
      request: requestView(d, request, myId!),
      offers: canSee ? offersAll.map((o) => ({ ...o, ownerName: d.users.find((u) => u.id === o.ownerId)?.name || 'Student', ownerAvatarColor: d.users.find((u) => u.id === o.ownerId)?.avatarColor || '#4F46E5' })) : [],
      rental: d.rentals.find((r) => r.requestId === request.id) || null,
    };
  }

  match = path.match(/^\/requests\/([^/]+)\/offers$/);
  if (match && method === 'POST') {
    const request = d.requests.find((r) => r.id === match![1]);
    if (!request) fail('Request not found', 404);
    if (request.userId === myId) fail('You cannot quote on your own request');
    if (request.status !== 'open') fail('This request is no longer open');
    const price = Number(body.pricePerHour);
    if (!Number.isFinite(price) || price <= 0) fail('Enter a valid price per hour');
    if (d.offers.some((o) => o.requestId === request.id && o.ownerId === myId)) fail('You already sent an offer for this request');
    const offer: Offer = {
      id: uid('ofr_'), requestId: request.id, ownerId: myId!, ownerName: user.name,
      ownerAvatarColor: user.avatarColor, pricePerHourPaise: Math.round(price * 100),
      message: String(body.message || '').trim().slice(0, 300), status: 'pending', createdAt: new Date().toISOString(),
    };
    d.offers.unshift(offer);
    save();
    if (request.userId.startsWith('demo_')) scheduleDemoAccept(offer.id);
    else {
      notify(d, request.userId, 'offer:new', 'New offer for your request', `${user.name} quoted ₹${price}/hour for ${request.item}`, { requestId: request.id, offerId: offer.id });
      deliver(request.userId, { type: 'offer:new', data: { requestId: request.id, offer } });
    }
    return { offer };
  }

  match = path.match(/^\/requests\/([^/]+)\/cancel$/);
  if (match && method === 'POST') {
    const request = d.requests.find((r) => r.id === match![1]);
    if (!request) fail('Request not found', 404);
    if (request.userId !== myId) fail('Only the requester can cancel', 403);
    if (request.status !== 'open') fail('This request cannot be cancelled');
    request.status = 'cancelled';
    d.offers.filter((o) => o.requestId === request.id).forEach((o) => { o.status = 'cancelled'; });
    save();
    return { ok: true };
  }

  match = path.match(/^\/offers\/([^/]+)\/accept$/);
  if (match && method === 'POST') {
    const offer = d.offers.find((o) => o.id === match![1]);
    if (!offer) fail('Offer not found', 404);
    const request = d.requests.find((r) => r.id === offer.requestId);
    if (!request || request.userId !== myId) fail('Only the requester can accept an offer', 403);
    if (request.status !== 'open') fail('This request is already matched');
    offer.status = 'accepted';
    d.offers.filter((o) => o.requestId === request.id && o.id !== offer.id).forEach((o) => { o.status = 'declined'; });
    request.status = 'matched';
    const rental: Rental = {
      id: uid('rnt_'), requestId: request.id, offerId: offer.id, borrowerId: myId!, ownerId: offer.ownerId,
      item: request.item, hours: request.hours, agreedPricePaise: offer.pricePerHourPaise, status: 'accepted',
      firstPaymentPaise: 0, secondPaymentPaise: 0, escrowPaise: 0, paidOutPaise: 0,
      createdAt: new Date().toISOString(),
      timeline: [{ status: 'accepted', at: new Date().toISOString(), note: `${user.name} accepted ${offer.ownerName}'s quote` }],
    };
    d.rentals.unshift(rental);
    save();
    notify(d, offer.ownerId, 'offer:accepted', 'Your offer was accepted! 🎉', `${user.name} picked your quote for ${request.item}`, { rentalId: rental.id, requestId: request.id });
    deliver(offer.ownerId, { type: 'rental:new', data: rentalView(d, rental, offer.ownerId) });
    return { rental: rentalView(d, rental, myId!) };
  }

  if (path === '/rentals' && method === 'GET') {
    return { rentals: d.rentals.filter((r) => r.borrowerId === myId || r.ownerId === myId).map((r) => rentalView(d, r, myId!)) };
  }

  match = path.match(/^\/rentals\/([^/]+)$/);
  if (match && method === 'GET') {
    const rental = d.rentals.find((r) => r.id === match![1]);
    if (!rental) fail('Rental not found', 404);
    if (rental.borrowerId !== myId && rental.ownerId !== myId) fail('Not your rental', 403);
    return { rental: rentalView(d, rental, myId!) };
  }

  match = path.match(/^\/rentals\/([^/]+)\/(pay-advance|pay-balance|confirm-return|cancel)$/);
  if (match && method === 'POST') {
    const rental = d.rentals.find((r) => r.id === match![1]);
    if (!rental) fail('Rental not found', 404);
    const action = match![2];
    if (action === 'pay-advance') {
      if (rental.borrowerId !== myId) fail('Only the borrower pays', 403);
      if (rental.status !== 'accepted') fail('Advance already paid or rental closed');
      holdPayment(d, rental);
      rental.status = 'active';
      rental.timeline.push({ status: 'active', at: new Date().toISOString(), note: `Advance of ₹${(rental.firstPaymentPaise / 100).toFixed(2)} paid and held in escrow` });
      save();
      notify(d, rental.ownerId, 'rental:updated', 'Advance received 💰', `₹${(rental.firstPaymentPaise / 100).toFixed(2)} is in escrow. Please hand over the ${rental.item}.`, { rentalId: rental.id });
      deliver(rental.ownerId, { type: 'rental:updated', data: rentalView(d, rental, rental.ownerId) });
      if (rental.ownerId.startsWith('demo_')) scheduleDemoOwnerConfirm(rental.id);
      return { rental: rentalView(d, rental, myId!), walletPaise: user.walletPaise };
    }
    if (action === 'pay-balance') {
      if (rental.borrowerId !== myId) fail('Only the borrower pays', 403);
      if (rental.status !== 'active') fail('Advance payment is required first');
      releasePayment(d, rental);
      rental.status = 'return_paid';
      rental.timeline.push({ status: 'return_paid', at: new Date().toISOString(), note: 'Balance paid. Awaiting owner confirmation' });
      save();
      notify(d, rental.ownerId, 'rental:updated', 'Balance received ✅', `Please confirm the ${rental.item} was returned.`, { rentalId: rental.id });
      deliver(rental.ownerId, { type: 'rental:updated', data: rentalView(d, rental, rental.ownerId) });
      if (rental.ownerId.startsWith('demo_')) scheduleDemoOwnerConfirm(rental.id);
      return { rental: rentalView(d, rental, myId!), walletPaise: user.walletPaise };
    }
    if (action === 'confirm-return') {
      if (rental.ownerId !== myId) fail('Only the owner can confirm the return', 403);
      if (rental.status !== 'return_paid') fail('The borrower has not paid the balance yet');
      payoutPayment(d, rental);
      rental.status = 'completed';
      rental.timeline.push({ status: 'completed', at: new Date().toISOString(), note: 'Returned. Rent released to owner' });
      save();
      notify(d, rental.borrowerId, 'rental:updated', 'Rental completed 🎉', `The ${rental.item} rental is all settled.`, { rentalId: rental.id });
      deliver(rental.borrowerId, { type: 'rental:updated', data: rentalView(d, rental, rental.borrowerId) });
      return { rental: rentalView(d, rental, myId!), walletPaise: user.walletPaise };
    }
    if (action === 'cancel') {
      if (rental.borrowerId !== myId && rental.ownerId !== myId) fail('Not your rental', 403);
      if (!['accepted', 'active'].includes(rental.status)) fail('This rental can no longer be cancelled');
      refundPayment(d, rental);
      rental.status = 'cancelled';
      rental.timeline.push({ status: 'cancelled', at: new Date().toISOString(), note: rental.refundedPaise ? 'Cancelled — advance refunded' : 'Cancelled before payment' });
      const request = d.requests.find((r) => r.id === rental.requestId);
      if (request && request.status === 'matched') request.status = 'cancelled';
      save();
      return { ok: true };
    }
  }

  if (path === '/wallet' && method === 'GET') {
    return { walletPaise: user.walletPaise || 0, transactions: d.transactions.filter((t) => t.userId === myId).slice(0, 50) };
  }

  if (path === '/wallet/topup' && method === 'POST') {
    const amount = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(amount) || amount <= 0) fail('Invalid amount');
    user.walletPaise = (user.walletPaise || 0) + amount;
    ledger(d, { userId: myId!, type: 'topup', amountPaise: amount, rentalId: null, counterpartyId: null, note: 'Sandbox wallet top-up' });
    save();
    deliver(myId!, { type: 'wallet:updated', data: { walletPaise: user.walletPaise } });
    return { ok: true, walletPaise: user.walletPaise };
  }

  fail(`Unknown route: ${method} ${path}`, 404);
}
