import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { Card, Screen } from '../src/ui';
import { C } from '../src/theme';

const STEPS = [
  ['1️⃣', 'Ask me up', 'Post what you need and for how long. Every student at your college sees it instantly.'],
  ['2️⃣', 'Get offers', 'People who own it reply with their price per hour. You compare and accept one.'],
  ['3️⃣', 'Meet & pay 50%', 'Check the item, then pay the advance. It stays safely in escrow.'],
  ['4️⃣', 'Return & pay rest', 'Return the item, pay the balance, and the owner confirms. Full rent is released to them.'],
];

export function HelpScreen() {
  const { close } = useApp();
  return (
    <Screen title="How Buddy Share works" subtitle="Borrow locally. Pay fairly. Build trust."
      right={<Text onPress={close} style={styles.close}>✕</Text>}>
      {STEPS.map(([icon, title, text]) => (
        <Card key={title} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.icon}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.text}>{text}</Text>
            </View>
          </View>
        </Card>
      ))}
      <Card style={styles.tip}>
        <Text style={styles.tipTitle}>💡 Trust tips</Text>
        <Text style={styles.text}>Meet in a public campus spot, check the item before paying, and report any issue. Keep first rentals small.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { color: C.muted, fontSize: 18, fontWeight: '700', padding: 8 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  icon: { fontSize: 24 },
  title: { fontSize: 15, fontWeight: '800', color: C.text },
  text: { fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 5 },
  tip: { backgroundColor: C.warnLight, borderColor: '#FDE68A' },
  tipTitle: { fontSize: 15, fontWeight: '800', color: C.warn, marginBottom: 4 },
});
