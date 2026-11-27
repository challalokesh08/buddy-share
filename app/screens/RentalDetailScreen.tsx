import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../src/api';
import { useApp } from '../src/app-context';
import type { Rental } from '../src/types';
import { Avatar, Btn, Card, Empty, Pill, SectionTitle } from '../src/ui';
import { C, durationLabel, money, statusMeta, timeAgo } from '../src/theme';

const STEPS = [
  { key: 'accepted', label: 'Matched', icon: '🤝' },
  { key: 'active', label: '50% paid', icon: '💰' },
  { key: 'return_paid', label: 'Returned', icon: '↩️' },
  { key: 'completed', label: 'Settled', icon: '✅' },
];

export function RentalDetailScreen({ id }: { id: string }) {
  const { close, setTab, payAdvance, payBalance, confirmReturn, cancelRental, walletPaise, rentals } = useApp();
  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ rental: Rental }>(`/rentals/${id}`);
      setRental(data.rental);
    } catch { /* parent handles */ }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Keep this screen live when a peer acts (advance, balance, return confirmation).
  useEffect(() => {
    const fresh = rentals.find((r) => r.id === id);
    if (fresh) {
      setRental((prev) => (
        prev && prev.status === fresh.status && prev.timeline.length === fresh.timeline.length
          ? prev
          : fresh
      ));
    }
  }, [rentals, id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); await fn(); setBusy(false); load();
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={C.primary} style={{ marginTop: 80 }} /></SafeAreaView>;
  if (!rental) return <SafeAreaView style={styles.safe}><Empty title="Rental not found" /></SafeAreaView>;

  const total = rental.totalPaise ?? rental.agreedPricePaise * rental.hours;
  const half = Math.round(total / 2);
  const isBorrower = rental.role === 'borrower';
  const meta = statusMeta[rental.status] || statusMeta.accepted;
  const currentStep = rental.status === 'cancelled' ? -1 : STEPS.findIndex((s) => s.key === rental.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable onPress={close} style={styles.back}><Text style={styles.backText}>←</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{rental.item}</Text>
            <Text style={styles.subtitle}>{isBorrower ? 'Borrowing from' : 'Lending to'} {rental.counterparty?.name} · {timeAgo(rental.createdAt)}</Text>
          </View>
          <Pill label={meta.label} color={meta.color} bg={meta.bg} />
        </View>

        <View style={styles.stepper}>
          {STEPS.map((step, i) => (
            <View key={step.key} style={styles.stepCol}>
              <View style={[styles.stepDot, i <= currentStep && styles.stepDotDone]}>{i <= currentStep ? <Text style={styles.stepIcon}>{step.icon}</Text> : <Text style={styles.stepNum}>{i + 1}</Text>}</View>
              <Text style={[styles.stepLabel, i <= currentStep && styles.stepLabelDone]}>{step.label}</Text>
            </View>
          ))}
        </View>

        <Card>
          <View style={styles.person}>
            <Avatar name={rental.counterparty?.name || 'Student'} color={rental.counterparty?.avatarColor} size={44} />
            <View>
              <Text style={styles.personLabel}>{isBorrower ? 'Item owner' : 'Borrower'}</Text>
              <Text style={styles.personName}>{rental.counterparty?.name}</Text>
              <Text style={styles.personEmail}>{rental.counterparty?.email}</Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Payment breakdown</SectionTitle>
        <Card>
          <Line label="Rate per hour" value={money(rental.agreedPricePaise)} />
          <Line label="Duration" value={durationLabel(rental.hours)} />
          <Line label="Total rent" value={money(total)} bold />
          <View style={styles.divider} />
          <Line label="Advance (50%) at handover" value={money(half)} />
          <Line label="Balance (50%) on return" value={money(total - half)} />
          <View style={styles.divider} />
          <Line label="Held in escrow" value={money(rental.escrowPaise)} color={C.accent} />
          {rental.paidOutPaise ? <Line label="Released to owner" value={money(rental.paidOutPaise)} color={C.success} /> : null}
          {rental.refundedPaise ? <Line label="Refunded" value={money(rental.refundedPaise)} color={C.warn} /> : null}
        </Card>

        {isBorrower ? (
          <View style={styles.actions}>
            {rental.status === 'accepted' ? (
              <>
                <Text style={styles.actionNote}>Meet the owner, check the item, then pay the advance to start the rental.</Text>
                <Btn label={`Pay ${money(half)} advance (50%)`} onPress={() => run(() => payAdvance(rental.id))} loading={busy} />
                <Btn label="Cancel rental" variant="danger" onPress={() => run(() => cancelRental(rental.id))} small />
              </>
            ) : null}
            {rental.status === 'active' ? (
              <>
                <Text style={styles.actionNote}>Returned the item? Pay the remaining {money(total - half)} so the owner can confirm.</Text>
                <Btn label={`Return & pay ${money(total - half)}`} onPress={() => run(() => payBalance(rental.id))} loading={busy} variant="accent" />
                <Btn label="Cancel rental" variant="danger" onPress={() => run(() => cancelRental(rental.id))} small />
              </>
            ) : null}
            {rental.status === 'return_paid' ? (
              <View style={styles.waiting}><Text style={styles.waitingText}>⏳ Waiting for the owner to confirm the return</Text></View>
            ) : null}
            {rental.status === 'completed' ? (
              <View style={styles.waiting}><Text style={styles.waitingText}>✅ All settled. Thanks for sharing!</Text></View>
            ) : null}
            {['accepted', 'active'].includes(rental.status) && walletPaise < half ? (
              <Pressable onPress={() => { close(); setTab('wallet'); }} style={styles.topup}>
                <Text style={styles.topupText}>Wallet low — add money →</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.actions}>
            {rental.status === 'accepted' ? <View style={styles.waiting}><Text style={styles.waitingText}>⏳ Waiting for the borrower to pay the advance</Text></View> : null}
            {rental.status === 'active' ? <View style={styles.waiting}><Text style={styles.waitingText}>🤝 Hand over the item. The advance is safely in escrow.</Text></View> : null}
            {rental.status === 'return_paid' ? (
              <>
                <Text style={styles.actionNote}>Got the item back? Confirm and the full {money(total)} goes straight to your wallet.</Text>
                <Btn label="Confirm return & get paid" onPress={() => run(() => confirmReturn(rental.id))} loading={busy} variant="accent" />
              </>
            ) : null}
            {rental.status === 'completed' ? <View style={styles.waiting}><Text style={styles.waitingText}>✅ {money(total)} released to your wallet</Text></View> : null}
          </View>
        )}

        <SectionTitle>Activity</SectionTitle>
        <Card>
          {rental.timeline.map((event, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineNote}>{event.note}</Text>
                <Text style={styles.timelineTime}>{timeAgo(event.at)}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Line({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return <View style={styles.line}><Text style={styles.lineLabel}>{label}</Text><Text style={[styles.lineValue, bold && styles.lineBold, color && { color }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  back: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: C.text },
  title: { fontSize: 21, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 11, color: C.muted, marginTop: 3 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 },
  stepCol: { alignItems: 'center', flex: 1 },
  stepDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: C.primary },
  stepIcon: { fontSize: 17 },
  stepNum: { color: C.faint, fontWeight: '800', fontSize: 13 },
  stepLabel: { fontSize: 10, color: C.faint, marginTop: 6, fontWeight: '600' },
  stepLabelDone: { color: C.primary },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personLabel: { fontSize: 10, color: C.faint, textTransform: 'uppercase', fontWeight: '700' },
  personName: { fontSize: 16, fontWeight: '800', color: C.text, marginTop: 2 },
  personEmail: { fontSize: 11, color: C.muted, marginTop: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  lineLabel: { fontSize: 13, color: C.muted, flex: 1 },
  lineValue: { fontSize: 13, color: C.text, fontWeight: '600' },
  lineBold: { fontWeight: '800', fontSize: 15 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  actions: { marginTop: 20, gap: 10 },
  actionNote: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 2 },
  waiting: { backgroundColor: C.primaryLight, borderRadius: 14, padding: 16 },
  waitingText: { color: C.primary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  topup: { alignSelf: 'center', padding: 10 },
  topupText: { color: C.warn, fontWeight: '700', fontSize: 12 },
  timelineRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent, marginTop: 5 },
  timelineNote: { fontSize: 12, color: C.text, lineHeight: 18 },
  timelineTime: { fontSize: 10, color: C.faint, marginTop: 3 },
});
