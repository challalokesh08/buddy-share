'use strict';

const { getDb, save, uid, now } = require('./store');

// Money is stored in paise (integer) to avoid floating point drift.
function balance(userId) {
  return getDb().users.find((u) => u.id === userId)?.walletPaise || 0;
}

function ledger({ userId, type, amountPaise, rentalId, note, counterpartyId }) {
  getDb().transactions.unshift({
    id: uid('txn_'),
    userId,
    type, // topup | hold | release | refund
    amountPaise,
    rentalId: rentalId || null,
    counterpartyId: counterpartyId || null,
    note: note || '',
    createdAt: now(),
  });
}

function topup(userId, rupees) {
  const paise = Math.round(Number(rupees) * 100);
  if (!Number.isFinite(paise) || paise <= 0) throw Object.assign(new Error('Invalid amount'), { status: 400 });
  const user = getDb().users.find((u) => u.id === userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  user.walletPaise += paise;
  ledger({ userId, type: 'topup', amountPaise: paise, note: 'Sandbox wallet top-up' });
  save();
  return balance(userId);
}

// First 50% — debited from borrower and held in escrow.
function hold(rental) {
  const costPaise = rental.agreedPricePaise * rental.hours;
  const firstHalf = Math.round(costPaise / 2);
  const borrower = getDb().users.find((u) => u.id === rental.borrowerId);
  if (!borrower) throw new Error('Borrower not found');
  if (borrower.walletPaise < firstHalf) {
    throw Object.assign(new Error(`Insufficient wallet balance. Need ₹${(firstHalf / 100).toFixed(2)}`), { status: 402 });
  }
  borrower.walletPaise -= firstHalf;
  rental.firstPaymentPaise = firstHalf;
  rental.escrowPaise = firstHalf;
  ledger({
    userId: borrower.id,
    type: 'hold',
    amountPaise: firstHalf,
    rentalId: rental.id,
    counterpartyId: rental.ownerId,
    note: 'Advance rent (50%) held in escrow',
  });
  save();
  return firstHalf;
}

// Remaining 50% — debited from borrower, then full amount released to owner.
function release(rental) {
  const total = rental.agreedPricePaise * rental.hours;
  const rest = total - (rental.firstPaymentPaise || 0);
  const borrower = getDb().users.find((u) => u.id === rental.borrowerId);
  const owner = getDb().users.find((u) => u.id === rental.ownerId);
  if (!borrower || !owner) throw new Error('User not found');
  if (borrower.walletPaise < rest) {
    throw Object.assign(new Error(`Insufficient wallet balance. Need ₹${(rest / 100).toFixed(2)}`), { status: 402 });
  }
  borrower.walletPaise -= rest;
  rental.secondPaymentPaise = rest;
  rental.escrowPaise = total;
  ledger({
    userId: borrower.id,
    type: 'hold',
    amountPaise: rest,
    rentalId: rental.id,
    counterpartyId: owner.id,
    note: 'Balance rent (50%) held in escrow',
  });
  save();
  return rest;
}

function payout(rental) {
  const total = rental.agreedPricePaise * rental.hours;
  const owner = getDb().users.find((u) => u.id === rental.ownerId);
  if (!owner) throw new Error('Owner not found');
  owner.walletPaise += total;
  rental.escrowPaise = 0;
  rental.paidOutPaise = total;
  ledger({
    userId: owner.id,
    type: 'release',
    amountPaise: total,
    rentalId: rental.id,
    counterpartyId: rental.borrowerId,
    note: 'Rent released after return',
  });
  save();
  return total;
}

function refund(rental) {
  if (!rental.firstPaymentPaise) return 0;
  const borrower = getDb().users.find((u) => u.id === rental.borrowerId);
  borrower.walletPaise += rental.firstPaymentPaise;
  ledger({
    userId: borrower.id,
    type: 'refund',
    amountPaise: rental.firstPaymentPaise,
    rentalId: rental.id,
    note: 'Rental cancelled — advance refunded',
  });
  rental.escrowPaise = 0;
  rental.refundedPaise = rental.firstPaymentPaise;
  save();
  return rental.refundedPaise;
}

module.exports = { balance, topup, hold, release, payout, refund };
