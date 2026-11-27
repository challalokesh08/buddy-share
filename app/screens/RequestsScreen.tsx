import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { Empty, Screen, SectionTitle } from '../src/ui';
import { C } from '../src/theme';
import { RequestCard } from './AskScreen';

const FILTERS = ['All', 'Open', 'Matched'] as const;

export function RequestsScreen() {
  const { feed, open } = useApp();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const mine = useMemo(() => feed.filter((r) => r.isMine), [feed]);
  const visible = useMemo(() => mine.filter((r) => filter === 'All' || r.status === filter.toLowerCase()), [mine, filter]);

  return (
    <Screen title="My requests" subtitle="Track the things you asked for">
      <View style={styles.countRow}>
        <Text style={styles.countBig}>{mine.length}</Text>
        <Text style={styles.countLabel}>request{mine.length === 1 ? '' : 's'} posted</Text>
      </View>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle>Requests</SectionTitle>
      {visible.length === 0 ? (
        <Empty icon="🙋" title="Nothing here yet" text="Go to the Ask tab and tell your college what you need." />
      ) : visible.map((r) => <RequestCard key={r.id} request={r} onPress={() => open('request', { id: r.id })} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  countBig: { fontSize: 38, fontWeight: '800', color: C.primary },
  countLabel: { fontSize: 13, color: C.muted },
  filters: { flexDirection: 'row', gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EDEEF3' },
  filterActive: { backgroundColor: C.primary },
  filterText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
});
