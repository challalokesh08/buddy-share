import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../src/api';
import { useApp } from '../src/app-context';
import type { BorrowRequest, Offer, Rental } from '../src/types';
import { Avatar, Btn, Card, Empty, Field, Input, Pill, Screen, SectionTitle } from '../src/ui';
import { C, durationLabel, money, statusMeta, timeAgo } from '../src/theme';

export function RequestDetailScreen({ id }: { id: string }) {
  const { user, close, acceptOffer, sendOffer, cancelRequest, open, feed } = useApp();
  const [detail, setDetail] = useState<{ request: BorrowRequest; offers: Offer[]; rental: Rental | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ request: BorrowRequest; offers: Offer[]; rental: Rental | null }>(`/requests/${id}`);
      setDetail(data);
    } catch { /* handled by parent toast */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // New offers arriving over the live bus should appear without a manual refresh.
  useEffect(() => {
    const fresh = feed.find((r) => r.id === id);
    if (fresh && detail && fresh.offerCount !== detail.request.offerCount) load();
  }, [feed, id, detail, load]);

  if (loading) return <Screen><ActivityIndicator color={C.primary} style={{ marginTop: 80 }} /></Screen>;
  if (!detail) return <Screen><Empty title="Request not found" text="It may have been removed." /></Screen>;

  const { request, offers, rental } = detail;
  const isMine = request.userId === user?.id;
  const meta = statusMeta[request.status] || statusMeta.open;

  const quote = async () => {
    setBusy(true);
    const ok = await sendOffer(request.id, Number(price), message);
    setBusy(false);
    if (ok) { setPrice(''); setMessage(''); load(); }
  };

  return (
    <Screen
      title={request.item}
      subtitle={`Asked by ${isMine ? 'you' : request.userName} · ${timeAgo(request.createdAt)}`}
      right={<Pressable onPress={close} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable>}
    >
      <Card>
        <View style={styles.rowBetween}>
          <Pill label={meta.label} color={meta.color} bg={meta.bg} />
          <Pill label={`⏱ ${durationLabel(request.hours)}`} color={C.muted} bg="#F3F4F6" />
        </View>
        <Text style={styles.label}>Category</Text>
        <Text style={styles.value}>{request.category}</Text>
        {request.note ? (<><Text style={styles.label}>Message</Text><Text style={styles.value}>{request.note}</Text></>) : null}
      </Card>

      {rental ? (
        <Pressable onPress={() => { close(); open('rental', { id: rental.id }); }} style={styles.rentalBanner}>
          <Text style={styles.rentalBannerText}>🤝 A match was made — view the rental →</Text>
        </Pressable>
      ) : null}

      {isMine ? (
        <>
          <SectionTitle>Offers received ({offers.length})</SectionTitle>
          {offers.length === 0 ? <Empty icon="⏳" title="Waiting for offers" text="Nearby students will quote a price shortly. Keep the app open for instant alerts." /> : offers.map((offer) => (
            <Card key={offer.id} style={[styles.offerCard, offer.status === 'accepted' && styles.accepted]}>
              <View style={styles.offerHead}>
                <Avatar name={offer.ownerName || 'Student'} color={offer.ownerAvatarColor} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.owner}>{offer.ownerName}</Text>
                  <Text style={styles.time}>{timeAgo(offer.createdAt)}</Text>
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.price}>{money(offer.pricePerHourPaise)}</Text>
                  <Text style={styles.perHour}>/ hour</Text>
                </View>
              </View>
              {offer.message ? <Text style={styles.offerMessage}>“{offer.message}”</Text> : null}
              <Text style={styles.total}>Total for {durationLabel(request.hours)}: {money(offer.pricePerHourPaise * request.hours)}</Text>
              {request.status === 'open' ? (
                <View style={{ marginTop: 12 }}>
                  <Btn label="Accept this offer" onPress={async () => { setBusy(true); await acceptOffer(offer.id); setBusy(false); load(); }} loading={busy} small />
                </View>
              ) : <Pill label={statusMeta[offer.status]?.label || offer.status} color={statusMeta[offer.status]?.color} bg={statusMeta[offer.status]?.bg} />}
            </Card>
          ))}
          {request.status === 'open' ? (
            <Pressable onPress={async () => { await cancelRequest(request.id); close(); }} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel my request</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <SectionTitle>Quote a price</SectionTitle>
          {request.status === 'open' ? (
            <Card>
              {detail.offers.length === 0 ? null : <Pill label="You already quoted" color={C.accent} bg={C.accentLight} />}
              <Field label="Your price per hour (₹)">
                <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="e.g. 50" style={{ marginTop: 8 }} />
              </Field>
              <Field label="Message (optional)">
                <Input value={message} onChangeText={setMessage} placeholder="Available near the library, in good condition" multiline numberOfLines={2} style={{ minHeight: 70, textAlignVertical: 'top' }} />
              </Field>
              <Btn label={busy ? 'Sending…' : 'Send offer'} onPress={quote} disabled={!price || busy} loading={busy} />
              <Text style={styles.hint}>You'll get paid in full only after the item is returned and confirmed.</Text>
            </Card>
          ) : (
            <Empty icon="🔒" title="This request is closed" text="It's already matched with someone." />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: C.muted, fontSize: 16, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: C.faint, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 },
  value: { fontSize: 14, color: C.text, lineHeight: 20 },
  rentalBanner: { backgroundColor: C.accentLight, borderRadius: 14, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#99F6E4' },
  rentalBannerText: { color: C.accent, fontWeight: '700', fontSize: 13 },
  offerCard: { marginBottom: 12 },
  accepted: { borderColor: C.success, borderWidth: 2 },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  owner: { fontSize: 14, fontWeight: '700', color: C.text },
  time: { fontSize: 11, color: C.faint, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 19, fontWeight: '800', color: C.primary },
  perHour: { fontSize: 10, color: C.muted },
  offerMessage: { fontSize: 13, color: C.muted, marginTop: 12, fontStyle: 'italic', lineHeight: 19 },
  total: { fontSize: 12, color: C.text, marginTop: 10, fontWeight: '600' },
  hint: { fontSize: 11, color: C.faint, marginTop: 12, lineHeight: 16 },
  cancel: { alignSelf: 'center', padding: 16, marginTop: 6 },
  cancelText: { color: C.danger, fontWeight: '600', fontSize: 13 },
});
