import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { getSupabase, requireSupabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function isLoopbackHost(value: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(value);
}

function webAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const configured = env.appUrl?.replace(/\/+$/u, '');
  if (configured && /^https?:\/\//i.test(configured)) {
    try {
      return new URL(configured).origin;
    } catch {
      // ignore malformed EXPO_PUBLIC_APP_URL
    }
  }
  return '';
}

function getAppRedirectTo(path: string): string {
  if (Platform.OS === 'web') {
    const origin = webAppOrigin();
    if (origin) return new URL(`/${path}`, origin).toString();
  }

  const native = `comicsaki://${path}`;
  const url = makeRedirectUri({
    scheme: 'comicsaki',
    path,
    native,
  });

  // Expo Go + USB (`exp://127.0.0.1`) makes Google/Chrome open localhost on the
  // tablet itself → ERR_CONNECTION_REFUSED. Prefer a LAN/tunnel host, else the scheme.
  if (!isLoopbackHost(url)) return url;

  const hostUri = Constants.expoConfig?.hostUri || '';
  if (hostUri && !isLoopbackHost(hostUri)) {
    return `exp://${hostUri.replace(/\/$/, '')}/--/${path}`;
  }

  return native;
}

export function getOAuthRedirectTo() {
  return getAppRedirectTo('auth/callback');
}

export function getPasswordResetRedirectTo() {
  return getAppRedirectTo('reset-password');
}

export async function createSessionFromUrl(url: string) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { params, errorCode } = QueryParams.getQueryParams(url);
  const oauthError = params.error_description || params.error || errorCode;
  if (oauthError) {
    throw new Error(oauthError);
  }

  const code = params.code;
  if (typeof code === 'string' && code.length > 0) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (typeof accessToken === 'string' && typeof refreshToken === 'string') {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session;
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithOAuthProvider(provider: 'google' | 'apple' | 'facebook') {
  const supabase = requireSupabase();
  const isWeb = Platform.OS === 'web';
  const redirectTo = getOAuthRedirectTo();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // Manual redirect — avoids silent no-op when Supabase does not auto-navigate.
      skipBrowserRedirect: true,
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });

  if (error) throw error;
  if (!data?.url) {
    throw new Error('Δεν βρέθηκε URL για τη σύνδεση.');
  }

  if (isWeb) {
    if (typeof window !== 'undefined') {
      window.location.assign(data.url);
    }
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    await createSessionFromUrl(result.url);
  }
}

export async function signInWithApple() {
  const supabase = requireSupabase();

  if (Platform.OS !== 'ios') {
    await signInWithOAuthProvider('apple');
    return;
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Η Apple δεν επέστρεψε identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) throw error;

  if (credential.fullName) {
    const nameParts = [
      credential.fullName.givenName,
      credential.fullName.middleName,
      credential.fullName.familyName,
    ].filter(Boolean);

    if (nameParts.length > 0) {
      await supabase.auth.updateUser({
        data: {
          full_name: nameParts.join(' '),
          given_name: credential.fullName.givenName,
          family_name: credential.fullName.familyName,
        },
      });
    }
  }
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectTo(),
  });

  if (error) throw error;
}
