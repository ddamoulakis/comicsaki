import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/contexts/AuthProvider';
import { CoverZoomProvider } from '@/contexts/CoverZoomProvider';
import { InboxBadgeProvider } from '@/contexts/InboxBadgeProvider';
import { fonts } from '@/constants/fonts';
import {
  PHONE_SHELL_HEIGHT,
  PHONE_SHELL_INSETS,
  PHONE_SHELL_WIDTH,
} from '@/constants/phoneShell';
import { usePhoneShellActive, usePixelSnappedPhoneShell } from '@/hooks/useAppViewport';
import { applyAppFontDefaults } from '@/lib/applyAppFontDefaults';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const PHONE_SHELL_FRAME = {
  x: 0,
  y: 0,
  width: PHONE_SHELL_WIDTH,
  height: PHONE_SHELL_HEIGHT,
};

const PHONE_SHELL_INSETS_VALUE = {
  top: PHONE_SHELL_INSETS.top,
  left: PHONE_SHELL_INSETS.left,
  right: PHONE_SHELL_INSETS.right,
  bottom: PHONE_SHELL_INSETS.bottom,
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: require('../assets/fonts/PlaypenSans-Regular.ttf'),
    [fonts.medium]: require('../assets/fonts/PlaypenSans-Medium.ttf'),
    [fonts.semibold]: require('../assets/fonts/PlaypenSans-SemiBold.ttf'),
    [fonts.bold]: require('../assets/fonts/PlaypenSans-Bold.ttf'),
    [fonts.extrabold]: require('../assets/fonts/PlaypenSans-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      applyAppFontDefaults();
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return <RootLayoutNav />;
}

function AppTree() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <InboxBadgeProvider>
        <CoverZoomProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
              <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            </Stack>
          </ThemeProvider>
        </CoverZoomProvider>
      </InboxBadgeProvider>
    </AuthProvider>
  );
}

function PhoneShellSafeArea({ children }: { children: ReactNode }) {
  return (
    <SafeAreaFrameContext.Provider value={PHONE_SHELL_FRAME}>
      <SafeAreaInsetsContext.Provider value={PHONE_SHELL_INSETS_VALUE}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

function RootLayoutNav() {
  const phoneShell = usePhoneShellActive();
  usePixelSnappedPhoneShell();

  if (Platform.OS === 'web' && phoneShell) {
    return (
      <PhoneShellSafeArea>
        <AppTree />
      </PhoneShellSafeArea>
    );
  }

  return (
    <SafeAreaProvider>
      <AppTree />
    </SafeAreaProvider>
  );
}
