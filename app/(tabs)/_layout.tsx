import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/Theme';
import { getTabBarHeight } from '@/constants/phoneShell';
import { useAuth } from '@/contexts/AuthProvider';
import { useInboxBadge } from '@/contexts/InboxBadgeProvider';

const TAB_COLORS = {
  index: theme.kirbyRed,
  collection: theme.kirbyBlue,
  add: theme.cosmicGreen,
  listings: theme.kirbyYellow,
  market: theme.kirbyRed,
  profile: theme.cosmicGreen,
} as const;

const hideTabLabel = () => null;

const JaggedTabIcon = memo(function JaggedTabIcon({
  name,
  color,
  focused,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  badge?: string;
}) {
  return (
    <View style={styles.tabIconWrap}>
      <View
        style={[
          styles.tabChip,
          {
            backgroundColor: color,
            opacity: focused ? 1 : 0.78,
          },
          styles.tabChipNative,
        ]}>
        <View style={styles.iconBox}>
          <Ionicons name={name} size={24} color={theme.cosmicInk} />
        </View>
      </View>
      {badge ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
});

function HomeTabIcon({ focused }: { focused: boolean }) {
  return <JaggedTabIcon name="home" color={TAB_COLORS.index} focused={focused} />;
}

function CollectionTabIcon({ focused }: { focused: boolean }) {
  return <JaggedTabIcon name="albums" color={TAB_COLORS.collection} focused={focused} />;
}

function AddTabIcon({ focused }: { focused: boolean }) {
  return <JaggedTabIcon name="add" color={TAB_COLORS.add} focused={focused} />;
}

function ListingsTabIcon({ focused }: { focused: boolean }) {
  return <JaggedTabIcon name="pricetag" color={TAB_COLORS.listings} focused={focused} />;
}

function MarketTabIcon({ focused }: { focused: boolean }) {
  return <JaggedTabIcon name="newspaper" color={TAB_COLORS.market} focused={focused} />;
}

function ProfileTabIcon({ focused }: { focused: boolean }) {
  const { user } = useAuth();
  const { badge: inboxBadge } = useInboxBadge();
  return (
    <JaggedTabIcon
      name={user ? 'person-circle' : 'person'}
      color={TAB_COLORS.profile}
      focused={focused}
      badge={user ? inboxBadge : undefined}
    />
  );
}

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const barHeight = getTabBarHeight(insets.bottom);
  const verticalPad = Math.max(4, Math.round((barHeight - 48) / 2));
  const hideTabBar = segments.includes('cover') || segments.includes('barcode');

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarShowLabel: false,
      tabBarLabel: hideTabLabel,
      tabBarActiveTintColor: theme.cosmicInk,
      tabBarInactiveTintColor: theme.cosmicInk,
      animation: 'none' as const,
      tabBarStyle: hideTabBar
        ? { display: 'none' as const, height: 0 }
        : [
            styles.tabBar,
            {
              paddingTop: verticalPad,
              paddingBottom: verticalPad,
              height: barHeight,
              overflow: 'hidden' as const,
              justifyContent: 'center' as const,
              zIndex: 1000,
              elevation: 1000,
            },
          ],
      tabBarItemStyle: styles.tabItem,
      sceneContainerStyle: styles.scene,
      sceneStyle: styles.scene,
    }),
    [barHeight, verticalPad, hideTabBar],
  );

  const listingsListeners = useMemo(
    () => ({
      tabPress: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        router.replace('/(tabs)/listings');
      },
    }),
    [router],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Αρχική',
          tabBarIcon: HomeTabIcon,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Συλλογή',
          tabBarIcon: CollectionTabIcon,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Προσθήκη',
          tabBarIcon: AddTabIcon,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Αγγελίες',
          tabBarIcon: ListingsTabIcon,
        }}
        listeners={listingsListeners}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Νέες Κυκλοφορίες',
          tabBarIcon: MarketTabIcon,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Προφίλ',
          tabBarIcon: ProfileTabIcon,
        }}
      />
      <Tabs.Screen name="favorites" options={{ href: null, title: 'Αγαπημένα' }} />
      <Tabs.Screen name="favorite-series" options={{ href: null, title: 'Σειρά' }} />
      <Tabs.Screen name="issue-detail" options={{ href: null, title: 'Τεύχος' }} />
      <Tabs.Screen name="collection-item" options={{ href: null, title: 'Τεύχος συλλογής' }} />
      <Tabs.Screen name="collection-series" options={{ href: null, title: 'Σειρά συλλογής' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    zIndex: 0,
  },
  tabBar: {
    backgroundColor: '#0A1020',
    borderTopWidth: 3,
    borderTopColor: theme.cosmicInk,
    paddingTop: 0,
    paddingHorizontal: 4,
    overflow: 'hidden',
    zIndex: 1000,
    elevation: 1000,
  },
  tabItem: {
    paddingHorizontal: 0,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1001,
  },
  tabIconWrap: {
    width: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.kirbyRed,
    borderWidth: 2,
    borderColor: theme.cosmicInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.surface,
    lineHeight: 12,
  },
  tabChip: {
    minWidth: 48,
    width: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipNative: {
    borderWidth: 2,
    borderColor: theme.cosmicInk,
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.cosmicInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
