export type User = {
  id: string;
  name: string;
  email: string;
  collegeName: string;
  collegeDomain: string;
  avatarColor: string;
  createdAt: string;
};

export type Offer = {
  id: string;
  requestId: string;
  ownerId: string;
  ownerName?: string;
  ownerAvatarColor?: string;
  pricePerHourPaise: number;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
};

export type BorrowRequest = {
  id: string;
  userId: string;
  userName: string;
  userAvatarColor: string;
  collegeKey: string;
  item: string;
  note: string;
  hours: number;
  category: string;
  status: 'open' | 'matched' | 'cancelled';
  createdAt: string;
  isMine?: boolean;
  offerCount?: number;
  myOffer?: Offer | null;
};

export type RentalStatus = 'accepted' | 'active' | 'return_paid' | 'completed' | 'cancelled';

export type Rental = {
  id: string;
  requestId: string;
  offerId: string;
  borrowerId: string;
  ownerId: string;
  item: string;
  hours: number;
  agreedPricePaise: number;
  status: RentalStatus;
  firstPaymentPaise: number;
  secondPaymentPaise: number;
  escrowPaise: number;
  paidOutPaise: number;
  refundedPaise?: number;
  createdAt: string;
  timeline: { status: string; at: string; note: string }[];
  role?: 'borrower' | 'owner';
  totalPaise?: number;
  counterparty?: User;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
};

export type Transaction = {
  id: string;
  userId: string;
  type: 'topup' | 'hold' | 'release' | 'refund';
  amountPaise: number;
  rentalId: string | null;
  counterpartyId: string | null;
  note: string;
  createdAt: string;
};
