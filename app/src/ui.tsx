import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from './theme';
import { useApp } from './app-context';

export function Screen({
  title, subtitle, right, children, scroll = true,
}: {
  title?: string; subtitle?: string; right?: React.ReactNode;
  children: React.ReactNode; scroll?: boolean;
}) {
  const body = (
    <View style={styles.screenBody}>
      {title ? (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{title}</Text>
            {subtitle ? <Text style={styles.h2}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Card({ children, style, ...rest }: ViewProps & { children: React.ReactNode }) {
  return <View style={[styles.card, style]} {...rest}>{children}</View>;
}

export function Btn({
  label, onPress, variant = 'primary', disabled, loading, small,
}: {
  label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  disabled?: boolean; loading?: boolean; small?: boolean;
}) {
  const palette = {
    primary: { bg: C.primary, fg: '#fff' },
    secondary: { bg: C.primaryLight, fg: C.primary },
    ghost: { bg: 'transparent', fg: C.primary },
    danger: { bg: C.dangerLight, fg: C.danger },
    accent: { bg: C.accent, fg: '#fff' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn, small && styles.btnSmall,
        { backgroundColor: variant === 'ghost' ? 'transparent' : palette.bg },
        disabled && { opacity: 0.45 }, pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} size="small" /> : <Text style={[styles.btnText, { color: palette.fg }, small && styles.btnTextSmall]}>{label}</Text>}
    </Pressable>
  );
}

export function Avatar({ name, color = C.primary, size = 42, emoji }: { name: string; color?: string; size?: number; emoji?: string }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{emoji || initials}</Text>
    </View>
  );
}

export function Pill({ label, color = C.primary, bg = C.primaryLight }: { label: string; color?: string; bg?: string }) {
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color }]}>{label}</Text></View>;
}

export function Empty({ icon = '📭', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input({ style, ...props }: TextInputProps) {
  return <TextInput style={[styles.input, style]} placeholderTextColor={C.faint} {...props} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{children}</Text>
      {action}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function ToastView() {
  const { toastMessage } = useApp();
  if (!toastMessage) return null;
  const bg = toastMessage.kind === 'error' ? C.danger : toastMessage.kind === 'success' ? C.success : '#1F2937';
  return (
    <View style={[styles.toast, { backgroundColor: bg }]} pointerEvents="none">
      <Text style={styles.toastText}>{toastMessage.kind === 'error' ? '⚠️ ' : toastMessage.kind === 'success' ? '✅ ' : ''}{toastMessage.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 36 },
  screenBody: { paddingHorizontal: 20, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  h1: { fontSize: 27, fontWeight: '800', color: C.text, letterSpacing: -0.6 },
  h2: { fontSize: 13, color: C.muted, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border },
  btn: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnSmall: { minHeight: 38, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { fontWeight: '700', fontSize: 15 },
  btnTextSmall: { fontSize: 13 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 46, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: 12, color: C.faint, marginTop: 7 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 15, color: C.text, minHeight: 52 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionText: { fontSize: 16, fontWeight: '800', color: C.text },
  row: { flexDirection: 'row', alignItems: 'center' },
  toast: { position: 'absolute', left: 20, right: 20, bottom: 96, padding: 15, borderRadius: 14, alignItems: 'center', zIndex: 50 },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
});
