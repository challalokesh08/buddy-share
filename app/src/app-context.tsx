import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api, ApiError, getBaseUrl, getToken, IS_LOCAL_MODE, setBaseUrl, setToken, websocketUrl } from './api';
import { kickLocalEngine, subscribeLocal } from './local-api';
import type { AppNotification, BorrowRequest, Rental, Transaction, User } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type TabName = 'ask' | 'requests' | 'rentals' | 'wallet' | 'profile';
export type Overlay = { name: 'request' | 'rental' | 'notifications' | 'settings'; params?: any };
type ToastKind = 'success' | 'error' | 'info';

type AppContextValue = {
  ready: boolean;
  user: User | null;
  token: string | null;
  requestOtp: (email: string) => Promise<{ email: string; collegeName: string; devOtp?: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;

  tab: TabName;
  setTab: (tab: TabName) => void;
  overlay: Overlay | null;
  open: (name: Overlay['name'], params?: any) => void;
  close: () => void;

  feed: BorrowRequest[];
  rentals: Rental[];
  notifications: AppNotification[];
  unread: number;
  walletPaise: number;
  transactions: Transaction[];
  baseUrl: string;
  online: boolean;

  refresh: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  postRequest: (input: { item: string; note: string; hours: number; category: string }) => Promise<boolean>;
  sendOffer: (requestId: string, pricePerHour: number, message: string) => Promise<boolean>;
  acceptOffer: (offerId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  payAdvance: (rentalId: string) => Promise<void>;
  payBalance: (rentalId: string) => Promise<void>;
  confirmReturn: (rentalId: string) => Promise<void>;
  cancelRental: (rentalId: string) => Promise<void>;
  topup: (amount: number) => Promise<void>;
  markRead: (id?: string) => Promise<void>;
  changeServer: (url: string) => Promise<void>;

  toastMessage: { text: string; kind: ToastKind } | null;
  toast: (text: string, kind?: ToastKind) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>('ask');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [feed, setFeed] = useState<BorrowRequest[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [walletPaise, setWalletPaise] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [baseUrl, setBaseUrlState] = useState(CONFIGURED_URL());
  const [online, setOnline] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; kind: ToastKind } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeToken = useRef<string | null>(null);

  function CONFIGURED_URL() {
    return String(Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api');
  }

  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    setToastMessage({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2800);
  }, []);

  const showError = useCallback((err: unknown) => {
    toast(err instanceof Error ? err.message : 'Something went wrong', 'error');
  }, [toast]);

  const refreshWallet = useCallback(async () => {
    try {
      const data = await api<{ walletPaise: number; transactions: Transaction[] }>('/wallet');
      setWalletPaise(data.walletPaise);
      setTransactions(data.transactions);
    } catch { /* silent background refresh */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [requests, rentalsData, notes] = await Promise.all([
        api<{ requests: BorrowRequest[] }>('/requests'),
        api<{ rentals: Rental[] }>('/rentals'),
        api<{ notifications: AppNotification[] }>('/notifications'),
      ]);
      setFeed(requests.requests);
      setRentals(rentalsData.rentals);
      setNotifications(notes.notifications);
      await refreshWallet();
    } catch { /* silent background refresh */ }
  }, [refreshWallet]);

  // Boot: restore session.
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await getToken();
        setBaseUrlState(await getBaseUrl());
        if (savedToken) {
          const me = await api<{ user: User; walletPaise: number }>('/me', { token: savedToken });
          setTokenState(savedToken);
          activeToken.current = savedToken;
          setUser(me.user);
          setWalletPaise(me.walletPaise);
          await refresh();
        }
      } catch (err) {
        await setToken(null);
        if (err instanceof ApiError && err.status !== 0) toast('Session expired. Please sign in again.', 'info');
      } finally {
        setReady(true);
      }
    })();
  }, [refresh, toast]);

  // Realtime: on-device event bus for the standalone APK, WebSocket otherwise.
  useEffect(() => {
    if (!token) { setOnline(false); return; }
    let disposed = false;
    const handle = (message: any) => {
      if (disposed) return;
      try {
        switch (message.type) {
          case 'notification': {
            const note = message.data as AppNotification;
            setNotifications((prev) => [note, ...prev.filter((n) => n.id !== note.id)].slice(0, 60));
            Notifications.scheduleNotificationAsync({
              content: { title: note.title, body: note.body, sound: true },
              trigger: null,
            }).catch(() => {});
            break;
          }
          case 'request:new':
            toast(`New ask: ${message.data?.item || 'something'}`, 'info');
            refresh();
            break;
          case 'request:updated':
          case 'offer:new':
          case 'rental:new':
          case 'rental:updated':
            refresh();
            break;
          case 'wallet:updated':
            setWalletPaise(message.data?.walletPaise ?? 0);
            refreshWallet();
            break;
          default:
            break;
        }
      } catch { /* ignore malformed events */ }
    };

    if (IS_LOCAL_MODE) {
      setOnline(true);
      kickLocalEngine();
      const unsubscribe = user?.id ? subscribeLocal(user.id, handle) : () => {};
      return () => { disposed = true; unsubscribe(); setOnline(false); };
    }

    const connect = async () => {
      const url = await websocketUrl(token);
      if (disposed || activeToken.current !== token) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { if (!disposed) setOnline(true); };
      ws.onclose = () => {
        if (disposed || activeToken.current !== token) return;
        setOnline(false);
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
      ws.onmessage = (event) => {
        try { handle(JSON.parse(event.data as string)); } catch { /* ignore */ }
      };
    };
    connect();
    return () => {
      disposed = true;
      setOnline(false);
      if (retryRef.current) clearTimeout(retryRef.current);
      try { wsRef.current?.close(); } catch { /* ignore */ }
      wsRef.current = null;
    };
  }, [token, user?.id, refresh, refreshWallet, toast]);

  // Push token registration (works once an Expo project/EAS projectId is configured).
  useEffect(() => {
    if (!user || IS_LOCAL_MODE) return;
    (async () => {
      try {
        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const tokenInfo = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined as any);
        if (tokenInfo?.data) await api('/notifications/push-token', { method: 'POST', body: { token: tokenInfo.data } });
      } catch { /* push is optional — in-app notifications still work */ }
    })();
  }, [user]);

  const handleAction = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | null> => {
    try {
      const result = await fn();
      if (success) toast(success, 'success');
      await refresh();
      return result;
    } catch (err) {
      showError(err);
      return null;
    }
  }, [refresh, showError, toast]);

  const value = useMemo<AppContextValue>(() => ({
    ready,
    user,
    token,
    requestOtp: async (email) => {
      const result = await api<{ email: string; collegeName: string; devOtp?: string }>('/auth/request-otp', {
        method: 'POST', body: { email },
      });
      return result;
    },
    verifyOtp: async (email, code) => {
      const result = await api<{ token: string; user: User }>('/auth/verify-otp', { method: 'POST', body: { email, code } });
      await setToken(result.token);
      setTokenState(result.token);
      activeToken.current = result.token;
      setUser(result.user);
      toast(`Welcome, ${result.user.name.split(' ')[0]}!`, 'success');
      await refresh();
    },
    logout: async () => {
      try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
      await setToken(null);
      activeToken.current = null;
      setTokenState(null);
      setUser(null);
      setFeed([]); setRentals([]); setNotifications([]); setTransactions([]); setWalletPaise(0);
      setTab('ask'); setOverlay(null);
    },

    tab, setTab, overlay,
    open: (name, params) => setOverlay({ name, params }),
    close: () => setOverlay(null),

    feed, rentals, notifications,
    unread: notifications.filter((n) => !n.read).length,
    walletPaise, transactions, baseUrl, online,
    refresh, refreshWallet,

    postRequest: async (input) => {
      const result = await handleAction(() => api<{ request: BorrowRequest }>('/requests', { method: 'POST', body: input }), 'Your request is live!');
      return !!result;
    },
    sendOffer: async (requestId, pricePerHour, message) => {
      const result = await handleAction(() => api('/requests/' + requestId + '/offers', {
        method: 'POST', body: { pricePerHour, message },
      }), 'Offer sent!');
      return !!result;
    },
    acceptOffer: async (offerId) => {
      const result = await handleAction(() => api('/offers/' + offerId + '/accept', { method: 'POST', body: {} }), 'Match made! Pay the advance when you meet.');
      if (result) { setOverlay(null); setTab('rentals'); }
    },
    cancelRequest: async (requestId) => { await handleAction(() => api('/requests/' + requestId + '/cancel', { method: 'POST', body: {} }), 'Request cancelled'); },
    payAdvance: async (rentalId) => { await handleAction(() => api('/rentals/' + rentalId + '/pay-advance', { method: 'POST', body: {} }), '₹50% paid — safely held in escrow'); },
    payBalance: async (rentalId) => { await handleAction(() => api('/rentals/' + rentalId + '/pay-balance', { method: 'POST', body: {} }), 'Balance paid. Ask the owner to confirm the return.'); },
    confirmReturn: async (rentalId) => { await handleAction(() => api('/rentals/' + rentalId + '/confirm-return', { method: 'POST', body: {} }), 'Returned! Full rent released to you.'); },
    cancelRental: async (rentalId) => { await handleAction(() => api('/rentals/' + rentalId + '/cancel', { method: 'POST', body: {} }), 'Rental cancelled'); },
    topup: async (amount) => { await handleAction(() => api('/wallet/topup', { method: 'POST', body: { amount } }), `₹${amount} added to wallet`); },
    markRead: async (id) => {
      try {
        await api('/notifications/read', { method: 'POST', body: id ? { id } : {} });
        setNotifications((prev) => prev.map((n) => (!id || n.id === id ? { ...n, read: true } : n)));
      } catch { /* ignore */ }
    },
    changeServer: async (url) => {
      await setBaseUrl(url);
      setBaseUrlState(url);
      toast('Server URL updated', 'success');
    },

    toastMessage, toast,
  }), [ready, user, token, tab, overlay, feed, rentals, notifications, walletPaise, transactions, baseUrl, online, toastMessage, refresh, refreshWallet, handleAction, toast, showError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
