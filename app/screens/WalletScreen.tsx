import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { Btn, Card, Empty, Screen, SectionTitle } from '../src/ui';
import { C, money, timeAgo } from '../src/theme';

const PRESETS = [200, 500, 1000];

export function WalletScreen() {
  const { walletPaise, transactions, topup, user } = useApp();
  const [loading, setLoading] = useState(false);

  const add = async (amount: number) => {
    setLoading(true); await topup(amount); setLoading(false);
  };

  return (
    <Screen title="Wallet" subtitle="Sandbox money for testing the full flow">
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Available balance</Text>
        <Text style={styles.heroAmount}>{money(walletPaise)}</Text>
        <Text style={styles.heroSub}>Hi {user?.name.split(' ')[0]} · add funds to borrow items</Text>
      </View>

      <SectionTitle>Add money</SectionTitle>
      <View style={styles.presets}>
        {PRESETS.map((amount) => (
          <Pressable key={amount} onPress={() => add(amount)} disabled={loading} style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }]}>
            <Text style={styles.presetText}>+ ₹{amount}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sandbox}>🧪 Sandbox mode — no real money moves. Top-ups are instant.</Text>

      <SectionTitle>Transactions</SectionTitle>
      {transactions.length === 0 ? (
        <Empty icon="💳" title="No transactions yet" text="Add money above, then pay an advance on a rental." />
      ) : transactions.map((tx) => {
        const credit = tx.type === 'topup' || tx.type === 'release' || tx.type === 'refund';
        const labels: Record<string, string> = { topup: 'Wallet top-up', hold: 'Rent paid (escrow)', release: 'Rent received', refund: 'Refund' };
        return (
          <Card key={tx.id} style={styles.tx}>
            <View style={styles.txIcon}><Text>{credit ? '⬇️' : '⬆️'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txTitle}>{labels[tx.type] || tx.type}</Text>
              <Text style={styles.txNote}>{tx.note}</Text>
              <Text style={styles.txTime}>{timeAgo(tx.createdAt)}</Text>
            </View>
            <Text style={[styles.txAmount, { color: credit ? C.success : C.danger }]}>
              {credit ? '+' : '−'}{money(tx.amountPaise)}
            </Text>
          </Card>
        );
      })}
      {loading ? <Btn label="Adding..." loading /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: C.primary, borderRadius: 22, padding: 24, shadowColor: C.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 6 },
  heroLabel: { color: '#C7D2FE', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroAmount: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 6, letterSpacing: -1 },
  heroSub: { color: '#E0E7FF', fontSize: 12, marginTop: 8 },
  presets: { flexDirection: 'row', gap: 10 },
  preset: { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 14, alignItems: 'center' },
  presetText: { color: C.primary, fontWeight: '800', fontSize: 15 },
  sandbox: { fontSize: 11, color: C.faint, marginTop: 10, textAlign: 'center' },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  txIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  txNote: { fontSize: 11, color: C.muted, marginTop: 2 },
  txTime: { fontSize: 10, color: C.faint, marginTop: 3 },
  txAmount: { fontSize: 14, fontWeight: '800' },
});
