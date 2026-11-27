import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import type { AppNotification } from '../src/types';
import { Card, Empty, Pill, Screen } from '../src/ui';
import { C, timeAgo } from '../src/theme';

const ICONS: Record<string, string> = {
  'request:new': '📢', 'offer:new': '💬', 'offer:accepted': '🎉',
  'rental:updated': '🤝', 'rental:new': '🤝', 'wallet:updated': '💰',
};

export function NotificationsScreen() {
  const { notifications, markRead, close, open } = useApp();

  const tap = async (note: AppNotification) => {
    await markRead(note.id);
    const rentalId = note.data?.rentalId;
    const requestId = note.data?.requestId;
    if (rentalId) { close(); open('rental', { id: rentalId }); }
    else if (requestId) { close(); open('request', { id: requestId }); }
  };

  return (
    <Screen
      title="Notifications"
      subtitle="Live updates from your college"
      right={
        notifications.some((n) => !n.read) ? (
          <Pressable onPress={() => markRead()}><Text style={styles.markAll}>Mark all read</Text></Pressable>
        ) : undefined
      }
    >
      {notifications.length === 0 ? (
        <Empty icon="🔔" title="All quiet" text="When someone needs something or quotes you a price, you'll see it here instantly." />
      ) : notifications.map((note) => (
        <Pressable key={note.id} onPress={() => tap(note)}>
          <Card style={[styles.card, !note.read && styles.unread]}>
            <View style={styles.icon}><Text style={{ fontSize: 20 }}>{ICONS[note.type] || '🔔'}</Text></View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{note.title}</Text>
                {!note.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.body}>{note.body}</Text>
              <Text style={styles.time}>{timeAgo(note.createdAt)}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { color: C.primary, fontWeight: '700', fontSize: 12 },
  card: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  unread: { borderColor: '#C7D2FE', backgroundColor: '#FAFAFF' },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13, fontWeight: '800', color: C.text, flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  body: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 4 },
  time: { fontSize: 10, color: C.faint, marginTop: 6 },
});
