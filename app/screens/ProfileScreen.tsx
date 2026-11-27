import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { IS_LOCAL_MODE } from '../src/api';
import { resetLocalData } from '../src/local-api';
import { Avatar, Btn, Card, Field, Input, Row, Screen, SectionTitle } from '../src/ui';
import { C, money, timeAgo } from '../src/theme';

export function ProfileScreen() {
  const { user, walletPaise, logout, open, setTab, baseUrl, online, changeServer, refresh, toast } = useApp();
  const [url, setUrl] = useState(baseUrl);
  const [saving, setSaving] = useState(false);

  return (
    <Screen title="Profile" subtitle="Your college identity and settings">
      <Card>
        <Row style={styles.profileRow}>
          <Avatar name={user?.name || 'Student'} color={user?.avatarColor} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.college}>🎓 {user?.collegeName}</Text>
          </View>
        </Row>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{money(walletPaise)}</Text><Text style={styles.statLabel}>Wallet</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{online ? 'Live' : 'Off'}</Text><Text style={styles.statLabel}>Realtime</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{user ? timeAgo(user.createdAt).replace(' ago', '') : '—'}</Text><Text style={styles.statLabel}>Joined</Text></View>
        </View>
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card>
        <ListRow icon="💳" label="Wallet & transactions" onPress={() => setTab('wallet')} />
        <ListRow icon="🔔" label="Notifications" onPress={() => open('notifications')} />
        <ListRow icon="📚" label="How it works" onPress={() => open('settings', { focus: 'help' })} />
      </Card>

      <SectionTitle>{IS_LOCAL_MODE ? 'Offline demo' : 'Connection'}</SectionTitle>
      {IS_LOCAL_MODE ? (
        <Card>
          <Text style={styles.offlineTitle}>📱 Fully on-device</Text>
          <Text style={styles.offlineText}>Everything runs inside this app — no computer, server or Wi‑Fi needed. Your requests, wallet and rentals are saved on this phone. Cambridge classmates are simulated so you can try every step.</Text>
          <Pressable onPress={async () => { await resetLocalData(); await refresh(); toast('Demo data reset', 'success'); }} style={styles.reset}>
            <Text style={styles.resetText}>Reset demo data</Text>
          </Pressable>
        </Card>
      ) : (
        <Card>
          <Field label="Server URL" hint="Set this to the address printed when you start the server (your computer's IP on the same Wi-Fi).">
            <Input value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          </Field>
          <Btn label={saving ? 'Saving...' : 'Save & reconnect'} onPress={async () => { setSaving(true); await changeServer(url); setSaving(false); }} small variant="secondary" />
          <Text style={styles.current}>Current: {baseUrl}</Text>
        </Card>
      )}

      <Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Sign out</Text></Pressable>
    </Screen>
  );
}

function ListRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}>
      <Text style={styles.listIcon}>{icon}</Text>
      <Text style={styles.listLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileRow: { gap: 14 },
  name: { fontSize: 19, fontWeight: '800', color: C.text },
  email: { fontSize: 12, color: C.muted, marginTop: 3 },
  college: { fontSize: 12, color: C.primary, marginTop: 5, fontWeight: '700' },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderColor: C.border, marginTop: 18, paddingTop: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 10, color: C.faint, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  listIcon: { fontSize: 19 },
  listLabel: { flex: 1, fontSize: 14, color: C.text, fontWeight: '600' },
  chevron: { fontSize: 22, color: C.faint },
  current: { fontSize: 10, color: C.faint, marginTop: 8 },
  offlineTitle: { fontSize: 15, fontWeight: '800', color: C.accent },
  offlineText: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 8 },
  reset: { marginTop: 14, paddingVertical: 10 },
  resetText: { color: C.danger, fontWeight: '700', fontSize: 13 },
  logout: { alignSelf: 'center', padding: 18, marginTop: 10 },
  logoutText: { color: C.danger, fontWeight: '700', fontSize: 14 },
});
