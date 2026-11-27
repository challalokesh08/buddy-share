'use strict';

const express = require('express');
const { getDb, save, uid, now } = require('./store');
const { requireAuth, requestOtp, verifyOtp, logout } = require('./auth');
const { collegeFromEmail, COLLEGE_DOMAINS } = require('./config');
const payments = require('./payments');
const rt = require('./realtime');

const router = express.Router();
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[api]', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
  }
};

const rupees = (paise) => paise / 100;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function publicUser(user) {
  const { id, name, email, collegeName, collegeDomain, avatarColor, createdAt } = user;
  return { id, name, email, collegeName, collegeDomain, avatarColor, createdAt };
}

function requestView(req, request) {
  const db = getDb();
  const offers = db.offers.filter((o) => o.requestId === request.id);
  return {
    ...request,
    isMine: request.userId === req.user.id,
    offerCount: offers.length,
    myOffer: offers.find((o) => o.ownerId === req.user.id) || null,
  };
}

function rentalView(req, rental) {
  return {
    ...rental,
    role: rental.borrowerId === req.user.id ? 'borrower' : 'owner',
    totalPaise: rental.agreedPricePaise * rental.hours,
    counterparty: publicUser(getDb().users.find((u) =>
      u.id === (rental.borrowerId === req.user.id ? rental.ownerId : rental.borrowerId)
    ) || { id: '', name: 'Student' }),
  };
}

// ---------- public ----------
router.get('/health', (_req, res) => res.json({ ok: true, at: now() }));
router.get('/config', (_req, res) => res.json({ collegeDomains: COLLEGE_DOMAINS }));

// ---------- auth ----------
router.post('/auth/request-otp', wrap((req, res) => {
  const result = requestOtp(req.body.email);
  res.json({ ok: true, email: result.email, collegeName: result.college.collegeName, devOtp: result.devOtp });
}));

router.post('/auth/verify-otp', wrap((req, res) => {
  const { token, user } = verifyOtp(req.body.email, req.body.code);
  res.json({ token, user: publicUser(user) });
}));

router.post('/auth/logout', requireAuth, wrap((req, res) => {
  logout(req.token);
  res.json({ ok: true });
}));

// ---------- me / notifications ----------
router.get('/me', requireAuth, wrap((req, res) => {
  res.json({ user: publicUser(req.user), walletPaise: payments.balance(req.user.id) });
}));

router.post('/notifications/push-token', requireAuth, wrap((req, res) => {
  const token = String(req.body.token || '').trim();
  if (!token) fail('Token missing');
  const db = getDb();
  const user = db.users.find((u) => u.id === req.user.id);
  user.pushToken = token;
  db.pushTokens = db.pushTokens.filter((t) => t.token !== token);
  db.pushTokens.push({ userId: user.id, token, createdAt: now() });
  save();
  res.json({ ok: true });
}));

router.get('/notifications', requireAuth, wrap((req, res) => {
  const db = getDb();
  res.json({ notifications: db.notifications.filter((n) => n.userId === req.user.id).slice(0, 60) });
}));

router.post('/notifications/read', requireAuth, wrap((req, res) => {
  const db = getDb();
  const items = db.notifications.filter((n) => n.userId === req.user.id);
  const target = req.body.id ? items.find((n) => n.id === req.body.id) : null;
  if (req.body.id && !target) fail('Notification not found', 404);
  (target ? [target] : items).forEach((n) => { n.read = true; });
  save();
  res.json({ ok: true });
}));

// ---------- requests (Ask me up) ----------
router.post('/requests', requireAuth, wrap((req, res) => {
  const item = String(req.body.item || '').trim();
  const note = String(req.body.note || '').trim();
  const hours = Number(req.body.hours);
  const category = String(req.body.category || 'Other').trim();
  if (!item) fail('Tell us what you need');
  if (!Number.isFinite(hours) || hours <= 0 || hours > 720) fail('Duration must be between 1 minute and 30 days');
  const db = getDb();
  const request = {
    id: uid('req_'),
    userId: req.user.id,
    userName: req.user.name,
    userAvatarColor: req.user.avatarColor,
    collegeKey: req.user.collegeKey,
    item,
    note,
    hours,
    category,
    status: 'open',
    createdAt: now(),
  };
  db.requests.unshift(request);
  save();
  rt.broadcastToCollege(req.user.collegeKey, 'request:new', requestView(req, request), req.user.id);
  res.status(201).json({ request: requestView(req, request) });
}));

router.get('/requests', requireAuth, wrap((req, res) => {
  const db = getDb();
  const requests = db.requests
    .filter((r) => r.collegeKey === req.user.collegeKey)
    .slice(0, 100)
    .map((r) => requestView(req, r));
  res.json({ requests });
}));

router.get('/requests/:id', requireAuth, wrap((req, res) => {
  const db = getDb();
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request) fail('Request not found', 404);
  if (request.collegeKey !== req.user.collegeKey) fail('This request is from another college', 403);
  const offers = db.offers.filter((o) => o.requestId === request.id);
  const canSeeOffers = request.userId === req.user.id || offers.some((o) => o.ownerId === req.user.id);
  res.json({
    request: requestView(req, request),
    offers: canSeeOffers ? offers.map((o) => ({
      ...o,
      ownerName: db.users.find((u) => u.id === o.ownerId)?.name || 'Student',
      ownerAvatarColor: db.users.find((u) => u.id === o.ownerId)?.avatarColor || '#6366F1',
    })) : [],
    rental: db.rentals.find((r) => r.requestId === request.id) || null,
  });
}));

router.post('/requests/:id/offers', requireAuth, wrap((req, res) => {
  const db = getDb();
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request) fail('Request not found', 404);
  if (request.userId === req.user.id) fail('You cannot quote on your own request');
  if (request.status !== 'open') fail('This request is no longer open');
  const pricePerHour = Number(req.body.pricePerHour);
  if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) fail('Enter a valid price per hour');
  if (db.offers.some((o) => o.requestId === request.id && o.ownerId === req.user.id)) {
    fail('You already sent an offer for this request');
  }
  const offer = {
    id: uid('ofr_'),
    requestId: request.id,
    ownerId: req.user.id,
    ownerName: req.user.name,
    pricePerHourPaise: Math.round(pricePerHour * 100),
    message: String(req.body.message || '').trim().slice(0, 300),
    status: 'pending',
    createdAt: now(),
  };
  db.offers.unshift(offer);
  save();
  rt.notify({
    userId: request.userId,
    type: 'offer:new',
    title: 'New offer for your request',
    body: `${req.user.name} quoted ₹${pricePerHour}/hour for ${request.item}`,
    data: { requestId: request.id, offerId: offer.id },
  });
  rt.deliver(request.userId, { type: 'offer:new', data: { requestId: request.id, offer: offer } });
  res.status(201).json({ offer });
}));

router.post('/requests/:id/cancel', requireAuth, wrap((req, res) => {
  const db = getDb();
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request) fail('Request not found', 404);
  if (request.userId !== req.user.id) fail('Only the requester can cancel', 403);
  if (request.status !== 'open') fail('This request cannot be cancelled');
  request.status = 'cancelled';
  db.offers.filter((o) => o.requestId === request.id).forEach((o) => { o.status = 'cancelled'; });
  save();
  rt.broadcastToCollege(req.user.collegeKey, 'request:updated', { id: request.id, status: 'cancelled' }, req.user.id);
  res.json({ ok: true });
}));

router.post('/offers/:id/accept', requireAuth, wrap((req, res) => {
  const db = getDb();
  const offer = db.offers.find((o) => o.id === req.params.id);
  if (!offer) fail('Offer not found', 404);
  const request = db.requests.find((r) => r.id === offer.requestId);
  if (!request || request.userId !== req.user.id) fail('Only the requester can accept an offer', 403);
  if (request.status !== 'open') fail('This request is already matched');
  if (db.rentals.some((r) => r.requestId === request.id)) fail('A rental already exists');

  offer.status = 'accepted';
  db.offers.filter((o) => o.requestId === request.id && o.id !== offer.id).forEach((o) => { o.status = 'declined'; });
  request.status = 'matched';
  const rental = {
    id: uid('rnt_'),
    requestId: request.id,
    offerId: offer.id,
    borrowerId: request.userId,
    ownerId: offer.ownerId,
    item: request.item,
    hours: request.hours,
    agreedPricePaise: offer.pricePerHourPaise,
    status: 'accepted',
    firstPaymentPaise: 0,
    secondPaymentPaise: 0,
    escrowPaise: 0,
    paidOutPaise: 0,
    createdAt: now(),
    timeline: [{ status: 'accepted', at: now(), note: `${req.user.name} accepted ${offer.ownerName}'s quote` }],
  };
  db.rentals.unshift(rental);
  save();
  rt.notify({
    userId: offer.ownerId,
    type: 'offer:accepted',
    title: 'Your offer was accepted! 🎉',
    body: `${req.user.name} picked your quote for ${request.item}`,
    data: { rentalId: rental.id, requestId: request.id },
  });
  rt.deliver(offer.ownerId, { type: 'rental:new', data: rentalView({ user: db.users.find((u) => u.id === offer.ownerId) }, rental) });
  rt.broadcastToCollege(req.user.collegeKey, 'request:updated', { id: request.id, status: 'matched' }, req.user.id);
  res.status(201).json({ rental: rentalView(req, rental) });
}));

// ---------- rentals ----------
router.get('/rentals', requireAuth, wrap((req, res) => {
  const db = getDb();
  const rentals = db.rentals
    .filter((r) => r.borrowerId === req.user.id || r.ownerId === req.user.id)
    .map((r) => rentalView(req, r));
  res.json({ rentals });
}));

router.get('/rentals/:id', requireAuth, wrap((req, res) => {
  const db = getDb();
  const rental = db.rentals.find((r) => r.id === req.params.id);
  if (!rental) fail('Rental not found', 404);
  if (rental.borrowerId !== req.user.id && rental.ownerId !== req.user.id) fail('Not your rental', 403);
  res.json({ rental: rentalView(req, rental) });
}));

function pushRentalUpdate(rental, title, body, recipientId) {
  rt.notify({ userId: recipientId, type: 'rental:updated', title, body, data: { rentalId: rental.id } });
  for (const id of [rental.borrowerId, rental.ownerId]) {
    const user = getDb().users.find((u) => u.id === id);
    if (user) rt.deliver(id, { type: 'rental:updated', data: rentalView({ user }, rental) });
  }
}

router.post('/rentals/:id/pay-advance', requireAuth, wrap((req, res) => {
  const db = getDb();
  const rental = db.rentals.find((r) => r.id === req.params.id);
  if (!rental) fail('Rental not found', 404);
  if (rental.borrowerId !== req.user.id) fail('Only the borrower pays', 403);
  if (rental.status !== 'accepted') fail('Advance already paid or rental closed');
  const amount = payments.hold(rental);
  rental.status = 'active';
  rental.timeline.push({ status: 'active', at: now(), note: `Advance of ₹${rupees(amount).toFixed(2)} paid and held in escrow` });
  save();
  rt.deliver(req.user.id, { type: 'wallet:updated', data: { walletPaise: payments.balance(req.user.id) } });
  pushRentalUpdate(rental, 'Advance received 💰', `₹${rupees(amount).toFixed(2)} is in escrow. Please hand over the ${rental.item}.`, rental.ownerId);
  res.json({ rental: rentalView(req, rental), walletPaise: payments.balance(req.user.id) });
}));

router.post('/rentals/:id/pay-balance', requireAuth, wrap((req, res) => {
  const db = getDb();
  const rental = db.rentals.find((r) => r.id === req.params.id);
  if (!rental) fail('Rental not found', 404);
  if (rental.borrowerId !== req.user.id) fail('Only the borrower pays', 403);
  if (rental.status !== 'active') fail('Advance payment is required first');
  const amount = payments.release(rental);
  rental.status = 'return_paid';
  rental.timeline.push({ status: 'return_paid', at: now(), note: `Balance of ₹${rupees(amount).toFixed(2)} paid. Awaiting owner confirmation` });
  save();
  rt.deliver(req.user.id, { type: 'wallet:updated', data: { walletPaise: payments.balance(req.user.id) } });
  pushRentalUpdate(rental, 'Balance received ✅', `₹${rupees(amount).toFixed(2)} received. Please confirm the ${rental.item} was returned.`, rental.ownerId);
  res.json({ rental: rentalView(req, rental), walletPaise: payments.balance(req.user.id) });
}));

router.post('/rentals/:id/confirm-return', requireAuth, wrap((req, res) => {
  const db = getDb();
  const rental = db.rentals.find((r) => r.id === req.params.id);
  if (!rental) fail('Rental not found', 404);
  if (rental.ownerId !== req.user.id) fail('Only the owner can confirm the return', 403);
  if (rental.status !== 'return_paid') fail('The borrower has not paid the balance yet');
  const amount = payments.payout(rental);
  rental.status = 'completed';
  rental.timeline.push({ status: 'completed', at: now(), note: `Returned. ₹${rupees(amount).toFixed(2)} released to owner` });
  save();
  rt.deliver(req.user.id, { type: 'wallet:updated', data: { walletPaise: payments.balance(req.user.id) } });
  pushRentalUpdate(rental, 'Rental completed 🎉', `₹${rupees(amount).toFixed(2)} was released to ${req.user.name}.`, rental.borrowerId);
  res.json({ rental: rentalView(req, rental), walletPaise: payments.balance(req.user.id) });
}));

router.post('/rentals/:id/cancel', requireAuth, wrap((req, res) => {
  const db = getDb();
  const rental = db.rentals.find((r) => r.id === req.params.id);
  if (!rental) fail('Rental not found', 404);
  if (![rental.borrowerId, rental.ownerId].includes(req.user.id)) fail('Not your rental', 403);
  if (!['accepted', 'active'].includes(rental.status)) fail('This rental can no longer be cancelled');
  const refunded = payments.refund(rental);
  rental.status = 'cancelled';
  rental.timeline.push({ status: 'cancelled', at: now(), note: refunded ? `Cancelled — ₹${rupees(refunded).toFixed(2)} refunded` : 'Cancelled before payment' });
  const request = db.requests.find((r) => r.id === rental.requestId);
  if (request && request.status === 'matched') request.status = 'cancelled';
  save();
  pushRentalUpdate(rental, 'Rental cancelled', `${req.user.name} cancelled the ${rental.item} rental.`, rental.borrowerId === req.user.id ? rental.ownerId : rental.borrowerId);
  res.json({ ok: true });
}));

// ---------- wallet ----------
router.get('/wallet', requireAuth, wrap((req, res) => {
  const db = getDb();
  res.json({
    walletPaise: payments.balance(req.user.id),
    transactions: db.transactions.filter((t) => t.userId === req.user.id).slice(0, 50),
  });
}));

router.post('/wallet/topup', requireAuth, wrap((req, res) => {
  const walletPaise = payments.topup(req.user.id, req.body.amount);
  rt.deliver(req.user.id, { type: 'wallet:updated', data: { walletPaise } });
  res.json({ ok: true, walletPaise });
}));

module.exports = router;
