import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp, type TabName } from './src/app-context';
import { ToastView } from './src/ui';
import { C } from './src/theme';
import { AuthScreen } from './screens/AuthFlow';
import { AskScreen } from './screens/AskScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { RentalsScreen } from './screens/RentalsScreen';
import { WalletScreen } from './screens/WalletScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RequestDetailScreen } from './screens/RequestDetailScreen';
import { RentalDetailScreen } from './screens/RentalDetailScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { HelpScreen } from './screens/HelpScreen';

const TABS: { key: TabName; icon: string; label: string }[] = [
  { key: 'ask', icon: '🙋', label: 'Ask' },
  { key: 'requests', icon: '📬', label: 'Requests' },
  { key: 'rentals', icon: '🤝', label: 'Rentals' },
  { key: 'wallet', icon: '💳', label: 'Wallet' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

function TabBar() {
  const { tab, setTab, unread } = useApp();
  return (
    <SafeAreaView style={styles.tabSafe} edges={['bottom']}>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
            <View style={[styles.tabIconWrap, tab === t.key && styles.tabIconActive]}>
              <Text style={{ fontSize: 21 }}>{t.icon}</Text>
              {t.key === 'profile' && unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View> : null}
            </View>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Overlay() {
  const { overlay } = useApp();
  if (!overlay) return null;
  const id = overlay.params?.id;
  let screen: React.ReactNode = null;
  if (overlay.name === 'request' && id) screen = <RequestDetailScreen id={id} />;
  else if (overlay.name === 'rental' && id) screen = <RentalDetailScreen id={id} />;
  else if (overlay.name === 'notifications') screen = <NotificationsScreen />;
  else if (overlay.name === 'settings') screen = <HelpScreen />;
  if (!screen) return null;
  return <View style={styles.overlay}>{screen}</View>;
}

function Root() {
  const { ready, user, tab } = useApp();
  if (!ready) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingLogo}>🤝</Text>
        <Text style={styles.loadingName}>Buddy Share</Text>
        <ActivityIndicator color={C.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }
  if (!user) return <><AuthScreen /><ToastView /><StatusBar style="dark" /></>;

  return (
    <View style={styles.root}>
      <View style={styles.screenArea}>
        {tab === 'ask' ? <AskScreen /> : null}
        {tab === 'requests' ? <RequestsScreen /> : null}
        {tab === 'rentals' ? <RentalsScreen /> : null}
        {tab === 'wallet' ? <WalletScreen /> : null}
        {tab === 'profile' ? <ProfileScreen /> : null}
      </View>
      <TabBar />
      <Overlay />
      <ToastView />
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  screenArea: { flex: 1 },
  tabSafe: { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  tabBar: { flexDirection: 'row', height: 62 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIconWrap: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, position: 'relative' },
  tabIconActive: { backgroundColor: C.primaryLight },
  tabLabel: { fontSize: 10, color: C.faint, fontWeight: '600', marginTop: 2 },
  tabLabelActive: { color: C.primary, fontWeight: '800' },
  badge: { position: 'absolute', right: -4, top: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  loadingLogo: { fontSize: 52 },
  loadingName: { fontSize: 24, fontWeight: '800', color: C.primary, marginTop: 10 },
});
