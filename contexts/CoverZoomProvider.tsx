import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '@/constants/Theme';

type CoverZoomState = {
  uri: string;
  caption?: string;
} | null;

type CoverZoomContextValue = {
  openCover: (uri: string, caption?: string) => void;
  closeCover: () => void;
};

const CoverZoomContext = createContext<CoverZoomContextValue | null>(null);

export function useCoverZoom() {
  const ctx = useContext(CoverZoomContext);
  if (!ctx) {
    throw new Error('useCoverZoom must be used within CoverZoomProvider');
  }
  return ctx;
}

export function CoverZoomProvider({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState<CoverZoomState>(null);

  const closeCover = useCallback(() => setZoom(null), []);

  const openCover = useCallback((uri: string, caption?: string) => {
    const next = uri.trim();
    if (!next) return;
    setZoom({ uri: next, caption: caption?.trim() || undefined });
  }, []);

  useEffect(() => {
    if (!zoom) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeCover();
      return true;
    });
    return () => sub.remove();
  }, [zoom, closeCover]);

  const value = useMemo(() => ({ openCover, closeCover }), [openCover, closeCover]);

  return (
    <CoverZoomContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {zoom ? (
          <View style={styles.overlay} accessibilityViewIsModal>
            <Pressable
              style={styles.backdrop}
              onPress={closeCover}
              accessibilityRole="button"
              accessibilityLabel="Κλείσιμο μεγέθυνσης">
              <View style={styles.imageWrap} pointerEvents="none">
                <Image source={{ uri: zoom.uri }} style={styles.image} resizeMode="contain" />
                {zoom.caption ? (
                  <Text style={styles.caption} numberOfLines={3}>
                    {zoom.caption}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <Pressable
              style={styles.closeBtn}
              onPress={closeCover}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Κλείσιμο">
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </View>
    </CoverZoomContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 48,
  },
  imageWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  image: {
    width: '100%',
    flex: 1,
    maxHeight: '100%',
  },
  caption: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 18,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: theme.border,
  },
});
