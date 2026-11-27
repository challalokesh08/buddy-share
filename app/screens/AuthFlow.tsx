import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../src/app-context';
import { IS_LOCAL_MODE } from '../src/api';
import { Btn, Card, Field, Input } from '../src/ui';
import { C } from '../src/theme';

function Brand() {
  return (
    <View style={styles.brandWrap}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>🤝</Text>
      </View>
      <Text style={styles.brand}>Buddy Share</Text>
      <Text style={styles.tagline}>Borrow what you need.{'\n'}Share what you have.</Text>
    </View>
  );
}

export function AuthScreen() {
  const { requestOtp, baseUrl, toast } = useApp();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; collegeName: string; devOtp?: string } | null>(null);

  const submit = async () => {
    if (!email.trim()) return toast('Enter your college email', 'error');
    setLoading(true);
    try {
      setResult(await requestOtp(email.trim()));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.content}>
        <Brand />
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Sign in with college email</Text>
          <Text style={styles.cardText}>Only Cambridge Institute of Technology students can join. Use your official college email address.</Text>
          <Field label="Cambridge Institute of Technology email" hint="Use your @cambridge.edu.in address">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@cambridge.edu.in"
            />
          </Field>
          {loading ? <ActivityIndicator color={C.primary} style={{ marginVertical: 10 }} /> : <Btn label="Send verification code" onPress={submit} />}
          <Text style={styles.terms}>By continuing you agree to be kind, return things on time, and only list items you own.</Text>
        </Card>

        {result ? (
          <VerifyInline email={result.email} collegeName={result.collegeName} devOtp={result.devOtp} onDone={() => setResult(null)} />
        ) : null}

        <Text style={styles.server}>{IS_LOCAL_MODE ? '📱 Standalone demo — runs on your phone, no server or Wi‑Fi needed' : `Connected to: ${baseUrl}`}</Text>
      </View>
    </SafeAreaView>
  );
}

function VerifyInline({ email, collegeName, devOtp, onDone }: { email: string; collegeName: string; devOtp?: string; onDone: () => void }) {
  const { verifyOtp } = useApp();
  const [code, setCode] = useState(devOtp || '');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try { await verifyOtp(email, code.trim()); }
    catch (err) { useAppToast(err); }
    finally { setLoading(false); }
  };
  // Kept separate so the inline form can show errors via its own text.
  const [error, setError] = useState('');
  function useAppToast(err: unknown) { setError(err instanceof Error ? err.message : 'Verification failed'); }

  return (
    <Card style={[styles.card, styles.verifyCard]}>
      <Text style={styles.cardTitle}>Check your code 🔐</Text>
      <Text style={styles.cardText}>We sent a 6-digit code to {email}. Your college: {collegeName}.</Text>
      {devOtp ? (
        <Pressable onPress={() => setCode(devOtp)} style={styles.devBox}>
          <Text style={styles.devLabel}>SANDBOX MODE — your code</Text>
          <Text style={styles.devCode}>{devOtp}</Text>
          <Text style={styles.devHint}>Tap to fill it in</Text>
        </Pressable>
      ) : null}
      <Field label="6-digit code">
        <Input value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" style={styles.codeInput} />
      </Field>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={C.primary} /> : <Btn label="Verify & continue" onPress={submit} />}
      <Pressable onPress={onDone} style={styles.resend}><Text style={styles.resendText}>Use a different email</Text></Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 20 },
  brandWrap: { alignItems: 'center', marginBottom: 34 },
  logo: { width: 78, height: 78, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
  logoText: { fontSize: 38 },
  brand: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.8 },
  tagline: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  card: { padding: 22 },
  verifyCard: { marginTop: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 6 },
  cardText: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 18 },
  terms: { fontSize: 11, color: C.faint, marginTop: 16, lineHeight: 16, textAlign: 'center' },
  server: { fontSize: 10, color: C.faint, textAlign: 'center', marginTop: 18 },
  devBox: { backgroundColor: C.primaryLight, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 18, borderWidth: 1, borderColor: '#C7D2FE' },
  devLabel: { fontSize: 10, fontWeight: '800', color: C.primary, letterSpacing: 0.6 },
  devCode: { fontSize: 28, fontWeight: '800', color: C.primaryDark, letterSpacing: 8, marginVertical: 2 },
  devHint: { fontSize: 11, color: C.primary },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 10, fontWeight: '800' },
  error: { color: C.danger, fontSize: 12, marginBottom: 10 },
  resend: { alignSelf: 'center', padding: 12, marginTop: 4 },
  resendText: { color: C.primary, fontSize: 13, fontWeight: '600' },
});
