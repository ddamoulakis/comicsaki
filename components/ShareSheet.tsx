import { Ionicons } from '@expo/vector-icons';
import * as ExpoLinking from 'expo-linking';
import { useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '@/constants/Theme';

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

type ShareTarget = {
  key: string;
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  kind: 'http' | 'app' | 'copy-link' | 'copy-text' | 'print' | 'copy-open';
  href?: (payload: SharePayload) => string;
};

function isMobileWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function shareBody(payload: SharePayload) {
  return `${payload.text}\n${payload.url}`;
}

const APP_TARGETS: ShareTarget[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    icon: 'logo-whatsapp',
    kind: 'http',
    href: ({ text, url }) => {
      const msg = encodeURIComponent(`${text}\n${url}`);
      return isMobileWeb() ? `https://wa.me/?text=${msg}` : `https://web.whatsapp.com/send?text=${msg}`;
    },
  },
  {
    key: 'viber',
    label: 'Viber',
    color: '#7360F2',
    icon: 'chatbubble',
    kind: 'copy-open',
    href: ({ text, url }) =>
      Platform.OS === 'web'
        ? `viber://forward?text=${encodeURIComponent(`${text}\n${url}`)}`
        : `viber://forward?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    color: '#229ED9',
    icon: 'paper-plane',
    kind: 'http',
    href: ({ text, url }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    color: '#E4405F',
    icon: 'logo-instagram',
    kind: 'copy-open',
    href: () => 'https://www.instagram.com/',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    icon: 'logo-facebook',
    kind: 'http',
    href: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'messenger',
    label: 'Messenger',
    color: '#0084FF',
    icon: 'chatbubbles',
    kind: 'copy-open',
    href: ({ url }) =>
      isMobileWeb()
        ? `fb-messenger://share/?link=${encodeURIComponent(url)}`
        : 'https://www.messenger.com/',
  },
  {
    key: 'x',
    label: 'X',
    color: '#111111',
    icon: 'logo-twitter',
    kind: 'http',
    href: ({ text, url }) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: 'sms',
    label: 'Μηνύματα',
    color: '#34C759',
    icon: 'chatbubble-ellipses',
    kind: 'app',
    href: ({ text, url }) => `sms:?body=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    key: 'email',
    label: 'Mail',
    color: '#007AFF',
    icon: 'mail',
    kind: 'app',
    href: ({ title, text, url }) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
];

const ACTION_TARGETS: ShareTarget[] = [
  { key: 'copy-link', label: 'Αντιγραφή συνδέσμου', color: '#8E8E93', icon: 'link', kind: 'copy-link' },
  { key: 'copy-text', label: 'Αντιγραφή', color: '#8E8E93', icon: 'copy', kind: 'copy-text' },
  { key: 'print', label: 'Εκτύπωση', color: '#8E8E93', icon: 'print', kind: 'print' },
];

export function buildShareUrl(path: string, query: Record<string, string>): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(path, window.location.origin);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
  return ExpoLinking.createURL(path, { queryParams: query });
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // continue to execCommand
  }
  try {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    }
  } catch {
    // ignore
  }
  return false;
}

function openHref(href: string, kind: ShareTarget['kind']) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    void Linking.openURL(href);
    return;
  }

  if (kind === 'app' || href.startsWith('mailto:') || href.startsWith('sms:') || href.startsWith('viber:') || href.startsWith('fb-messenger:')) {
    window.location.href = href;
    return;
  }

  const popup = window.open(href, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.assign(href);
  }
}

export async function shareWithSystem(payload: SharePayload): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const content =
      Platform.OS === 'ios'
        ? { title: payload.title, url: payload.url, message: payload.text }
        : { title: payload.title, message: `${payload.text}\n${payload.url}` };
    const result = await Share.share(content);
    if (result.action === Share.dismissedAction) return 'cancelled';
    return 'shared';
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled';
    return 'unavailable';
  }
}

export function ShareSheet({
  visible,
  payload,
  onClose,
  onNotice,
}: {
  visible: boolean;
  payload: SharePayload | null;
  onClose: () => void;
  onNotice?: (message: string) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const body = useMemo(() => (payload ? shareBody(payload) : ''), [payload]);

  if (!visible || !payload) return null;

  const notice = (message: string) => {
    setStatus(message);
    onNotice?.(message);
  };

  const runTarget = (target: ShareTarget) => {
    const href = target.href?.(payload);

    if (target.kind === 'copy-link') {
      void copyToClipboard(payload.url).then((ok) => {
        notice(ok ? 'Ο σύνδεσμος αντιγράφηκε.' : 'Αποτυχία αντιγραφής συνδέσμου.');
      });
      return;
    }
    if (target.kind === 'copy-text') {
      void copyToClipboard(body).then((ok) => {
        notice(ok ? 'Το κείμενο αντιγράφηκε.' : 'Αποτυχία αντιγραφής.');
      });
      return;
    }
    if (target.kind === 'print') {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.print();
        notice('Άνοιξε το παράθυρο εκτύπωσης.');
      } else {
        notice('Η εκτύπωση είναι διαθέσιμη στο web.');
      }
      return;
    }
    if (target.kind === 'copy-open') {
      void copyToClipboard(body);
      if (href) openHref(href, target.kind);
      notice('Το κείμενο αντιγράφηκε. Επικόλλησέ το στην εφαρμογή.');
      return;
    }
    if (href) {
      openHref(href, target.kind);
      if (target.kind === 'app' && Platform.OS === 'web' && !isMobileWeb()) {
        void copyToClipboard(body);
        notice('Αν δεν άνοιξε η εφαρμογή, το κείμενο αντιγράφηκε.');
      }
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet} pointerEvents="auto">
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {payload.title}
        </Text>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <View style={styles.grid}>
          {APP_TARGETS.map((target) => (
            <Pressable key={target.key} style={styles.item} onPress={() => runTarget(target)}>
              <View style={[styles.appIcon, { backgroundColor: target.color }]}>
                <Ionicons name={target.icon} size={26} color="#fff" />
              </View>
              <Text style={styles.itemLabel} numberOfLines={2}>
                {target.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.divider} />
        <View style={styles.grid}>
          {ACTION_TARGETS.map((target) => (
            <Pressable key={target.key} style={styles.item} onPress={() => runTarget(target)}>
              <View style={styles.actionIcon}>
                <Ionicons name={target.icon} size={22} color={theme.text} />
              </View>
              <Text style={styles.itemLabel} numberOfLines={2}>
                {target.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Ακύρωση</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 40,
    elevation: 40,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 0,
  },
  sheet: {
    marginHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 8,
    gap: 8,
    zIndex: 2,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyMagenta,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 6,
  },
  item: {
    width: '20%',
    minWidth: 72,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    cursor: 'pointer',
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    lineHeight: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 12,
  },
  cancel: {
    marginHorizontal: 12,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    cursor: 'pointer',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#007AFF',
  },
});
