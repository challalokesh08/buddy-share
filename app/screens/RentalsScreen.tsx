import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import type { Rental } from '../src/types';
import { Avatar, Card, Empty, Pill, Screen, SectionTitle } from '../src/ui';
import { C, durationLabel, money, statusMeta, timeAgo } from '../src/theme';

const FILTERS = ['All', 'Borrowing', 'Lending'] as const;

export function RentalsScreen() {
  const { rentals, open } = useApp();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const visible = rentals.filter((r) => filter === 'All' || (filter === 'Borrowing' ? r.role === 'borrower' : r.role === 'owner'));

  return (
    <Screen title="My rentals" subtitle="Advance 50% → return → balance 50%">
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle>{visible.length} rental{visible.length === 1 ? '' : 's'}</SectionTitle>
      {visible.length === 0 ? (
        <Empty icon="🤝" title="No rentals yet" text="When someone accepts your offer (or you accept one), it'll appear here." />
      ) : visible.map((r) => <RentalCard key={r.id} rental={r} onPress={() => open('rental', { id: r.id })} />)}
    </Screen>
  );
}

export function RentalCard({ rental, onPress }: { rental: Rental; onPress: () => void }) {
  const meta = statusMeta[rental.status] || statusMeta.accepted;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
      <Card>
        <View style={styles.head}>
          <Avatar name={rental.counterparty?.name || 'Student'} color={rental.counterparty?.avatarColor} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{rental.item}</Text>
            <Text style={styles.sub}>{rental.role === 'borrower' ? 'Borrowing from' : 'Lending to'} {rental.counterparty?.name}</Text>
          </View>
          <Pill label={meta.label} color={meta.color} bg={meta.bg} />
        </View>
        <View style={styles.foot}>
          <Text style={styles.meta}>⏱ {durationLabel(rental.hours)}</Text>
          <Text style={styles.meta}>💰 {money((rental.totalPaise ?? rental.agreedPricePaise * rental.hours))}</Text>
          <Text style={styles.meta}>{timeAgo(rental.createdAt)}</Text>
        </View>
        {rental.status === 'active' ? <View style={styles.hint}><Text style={styles.hintText}>Advance paid · balance due on return</Text></View> : null}
        {rental.status === 'return_paid' ? <View style={styles.hint}><Text style={styles.hintText}>Owner needs to confirm the return</Text></View> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EDEEF3' },
  filterActive: { backgroundColor: C.primary },
  filterText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: { marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 16, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 3 },
  foot: { flexDirection: 'row', gap: 14, marginTop: 16, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: C.muted },
  hint: { marginTop: 12, backgroundColor: C.warnLight, borderRadius: 10, padding: 10 },
  hintText: { color: C.warn, fontSize: 11, fontWeight: '600' },
});
