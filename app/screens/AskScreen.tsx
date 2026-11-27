import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import type { BorrowRequest } from '../src/types';
import { Avatar, Btn, Card, Empty, Field, Input, Pill, Screen, SectionTitle } from '../src/ui';
import { C, durationLabel, statusMeta, timeAgo } from '../src/theme';

const CATEGORIES = ['Electronics', 'Sports', 'Books', 'Tools', 'Kitchen', 'Other'];
const ICONS: Record<string, string> = {
  Electronics: '💻', Sports: '🏀', Books: '📚', Tools: '🔧', Kitchen: '🍳', Other: '📦',
};
const FILTERS = ['All', 'Mine', 'My offers'] as const;

export function AskScreen() {
  const { feed, postRequest, open, user, online, refresh } = useApp();
  const [expanded, setExpanded] = useState(true);
  const [item, setItem] = useState('');
  const [note, setNote] = useState('');
  const [hours, setHours] = useState('2');
  const [category, setCategory] = useState('Electronics');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [posting, setPosting] = useState(false);

  const visible = useMemo(() => feed.filter((r) => {
    if (filter === 'Mine') return r.isMine;
    if (filter === 'My offers') return !!r.myOffer;
    return true;
  }), [feed, filter]);

  const submit = async () => {
    if (!item.trim()) return;
    setPosting(true);
    const ok = await postRequest({
      item: item.trim(), note: note.trim(), hours: Number(hours) || 1, category,
    });
    setPosting(false);
    if (ok) { setItem(''); setNote(''); setHours('2'); setExpanded(false); }
  };

  return (
    <Screen
      title="Ask me up"
      subtitle={`Hi ${user?.name.split(' ')[0] || 'there'} · ${user?.collegeName || 'your college'} · ${online ? '🟢 Live' : '⚪ Connecting'}`}
      right={
        <Pressable onPress={() => open('notifications')} style={styles.bell}>
          <Text style={{ fontSize: 22 }}>🔔</Text>
        </Pressable>
      }
    >
      <Card style={styles.compose}>
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.composeHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.composeTitle}>What do you need today?</Text>
            <Text style={styles.composeSub}>Post it — the whole college sees it instantly</Text>
          </View>
          <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
        </Pressable>

        {expanded ? (
          <View style={styles.composeBody}>
            <Field label="Item">
              <Input value={item} onChangeText={setItem} placeholder="e.g. Scientific calculator, bike, camera" />
            </Field>
            <Field label="Category">
              <View style={styles.chips}>
                {CATEGORIES.map((c) => (
                  <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{ICONS[c]} {c}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="How long do you need it?">
              <View style={styles.hoursRow}>
                <Input value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="2" style={{ flex: 1 }} />
                <View style={styles.hoursUnit}><Text style={styles.hoursUnitText}>hours</Text></View>
              </View>
            </Field>
            <Field label="Message (optional)" hint="Add context — where you'll meet, condition, etc.">
              <Input value={note} onChangeText={setNote} placeholder="Need it for tomorrow's exam, can collect at the library" multiline numberOfLines={2} style={{ minHeight: 74, textAlignVertical: 'top' }} />
            </Field>
            <Btn label={posting ? 'Posting…' : '📢 Post request'} onPress={submit} disabled={!item.trim()} loading={posting} />
          </View>
        ) : null}
      </Card>

      <SectionTitle action={
        <Pressable onPress={refresh}><Text style={styles.refresh}>↻ Refresh</Text></Pressable>
      }>Live in your college</SectionTitle>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {visible.length === 0 ? (
        <Empty icon="📭" title="No requests here yet" text="Post the first one, or pull down to refresh." />
      ) : visible.map((r) => <RequestCard key={r.id} request={r} onPress={() => open('request', { id: r.id })} />)}
    </Screen>
  );
}

export function RequestCard({ request, onPress }: { request: BorrowRequest; onPress: () => void }) {
  const meta = statusMeta[request.status] || statusMeta.open;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
      <Card style={styles.cardInner}>
        <View style={styles.cardTop}>
          <Avatar name={request.userName} color={request.userAvatarColor} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{request.isMine ? 'You' : request.userName}</Text>
            <Text style={styles.time}>{timeAgo(request.createdAt)} · {request.collegeKey?.toUpperCase()}</Text>
          </View>
          <Pill label={meta.label} color={meta.color} bg={meta.bg} />
        </View>
        <Text style={styles.item}>{ICONS[request.category] || '📦'} {request.item}</Text>
        {request.note ? <Text style={styles.note}>{request.note}</Text> : null}
        <View style={styles.cardFoot}>
          <Pill label={`⏱ ${durationLabel(request.hours)}`} color={C.muted} bg="#F3F4F6" />
          <Pill label={`${request.offerCount ?? 0} offer${(request.offerCount ?? 0) === 1 ? '' : 's'}`} color={C.primary} bg={C.primaryLight} />
          {request.myOffer ? <Pill label="You quoted" color={C.accent} bg={C.accentLight} /> : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  compose: { padding: 18 },
  composeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composeTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  composeSub: { fontSize: 12, color: C.muted, marginTop: 4 },
  chevron: { fontSize: 20, color: C.primary, paddingHorizontal: 8 },
  composeBody: { marginTop: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  chipText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  chipTextActive: { color: C.primary },
  hoursRow: { flexDirection: 'row', gap: 10 },
  hoursUnit: { backgroundColor: C.primaryLight, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' },
  hoursUnitText: { color: C.primary, fontWeight: '700' },
  refresh: { color: C.primary, fontWeight: '600', fontSize: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EDEEF3' },
  filterActive: { backgroundColor: C.primary },
  filterText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: { marginBottom: 12 },
  cardInner: { padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 13, fontWeight: '700', color: C.text },
  time: { fontSize: 11, color: C.faint, marginTop: 2 },
  item: { fontSize: 17, fontWeight: '800', color: C.text, marginTop: 14 },
  note: { fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 19 },
  cardFoot: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
});
