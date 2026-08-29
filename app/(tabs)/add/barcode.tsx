import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AddScreenHeader } from '@/components/add/AddScreenHeader';
import { ComicBorderCard } from '@/components/comicsaki/ComicBorderCard';
import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { theme } from '@/constants/Theme';
import { normalizeScannedBarcode } from '@/lib/barcodeNormalize';
import { setCoverLookupResult } from '@/lib/coverScanSession';
import { lookupComicByBarcode } from '@/services/barcodeLookup';

const isWeb = Platform.OS === 'web';

function isUsableCode(raw: string): boolean {
  const parsed = normalizeScannedBarcode(raw);
  if (parsed.isbn) return parsed.isbn.length >= 10;
  return Boolean(parsed.upc12 && parsed.upc12.length === 12) || parsed.digits.length >= 12;
}

function displayCode(raw: string): string {
  const parsed = normalizeScannedBarcode(raw);
  return parsed.isbn || parsed.upc12 || parsed.upcExact || parsed.digits;
}

export default function BarcodeScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [shutterArmed, setShutterArmed] = useState(false);
  const previewRawRef = useRef('');

  useEffect(() => {
    if (!cameraReady) {
      setShutterArmed(false);
      return;
    }
    const t = setTimeout(() => setShutterArmed(true), 800);
    return () => clearTimeout(t);
  }, [cameraReady]);

  const lookup = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (busy || !trimmed) return;
      setBusy(true);
      setError(null);
      try {
        const result = await lookupComicByBarcode(trimmed);
        setCoverLookupResult(result);
        router.push('/(tabs)/add/cover-results');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Αποτυχία αναζήτησης.');
      } finally {
        setBusy(false);
      }
    },
    [busy, router],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (busy || !shutterArmed) return;
      if (!isUsableCode(data)) return;
      previewRawRef.current = data;
      setPreviewCode(displayCode(data));
      setError(null);
    },
    [busy, shutterArmed],
  );

  const confirmPreview = () => {
    const raw = previewRawRef.current || previewCode;
    if (!raw) {
      setError('Στόχευσε το barcode μέχρι να εμφανιστεί ο αριθμός, μετά πάτα Αναζήτηση.');
      return;
    }
    void lookup(raw);
  };

  const resetPreview = () => {
    previewRawRef.current = '';
    setPreviewCode('');
    setError(null);
  };

  return (
    <CosmicBackground variant="ion">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          <AddScreenHeader
            title="BARCODE SCAN"
            subtitle="Στόχευσε, περίμενε τον αριθμό, μετά πάτα Αναζήτηση."
          />

          {!isWeb ? (
            <ComicBorderCard style={styles.cameraCard}>
              {permission?.granted ? (
                <>
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerEnabled={!busy}
                    barcodeScannerSettings={{
                      barcodeTypes: ['ean13', 'upc_a', 'upc_e'],
                    }}
                    onCameraReady={() => setCameraReady(true)}
                    onBarcodeScanned={busy ? undefined : onBarcodeScanned}
                  />
                  <View style={styles.frameOverlay} pointerEvents="none">
                    <View style={styles.frame} />
                    <Text style={styles.frameHint}>
                      {!shutterArmed
                        ? 'Περίμενε την κάμερα…'
                        : previewCode
                          ? previewCode
                          : 'Βάλε το πίσω barcode στο πλαίσιο'}
                    </Text>
                  </View>
                  {busy ? (
                    <View style={styles.busyOverlay}>
                      <ActivityIndicator size="large" color={theme.kirbyMagenta} />
                      <Text style={styles.scannedText}>Αναζήτηση {previewCode}…</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.permBox}>
                  <Text style={styles.permText}>Χρειάζεται άδεια κάμερας.</Text>
                  <Pressable style={styles.primaryBtn} onPress={requestPermission}>
                    <Text style={styles.primaryBtnText}>Να επιτραπεί</Text>
                  </Pressable>
                </View>
              )}
            </ComicBorderCard>
          ) : (
            <View style={styles.webBanner}>
              <Text style={styles.webBannerTitle}>Το barcode scanner δουλεύει σε κινητό / tablet</Text>
              <Text style={styles.webBannerSub}>
                Στο web πληκτρολόγησε UPC ή ISBN στο πεδίο παρακάτω.
              </Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!isWeb && permission?.granted ? (
            <Pressable
              style={[
                styles.primaryBtn,
                (busy || !shutterArmed || !previewCode) && styles.btnDisabled,
              ]}
              disabled={busy || !shutterArmed || !previewCode}
              onPress={confirmPreview}>
              {busy ? (
                <ActivityIndicator color={theme.surface} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {previewCode ? `Αναζήτηση ${previewCode}` : 'Περίμενε να διαβαστεί ο κωδικός'}
                </Text>
              )}
            </Pressable>
          ) : null}

          {previewCode && !busy ? (
            <Pressable style={styles.secondaryBtn} onPress={resetPreview}>
              <Text style={styles.secondaryBtnText}>Καθαρισμός / νέο στόχευμα</Text>
            </Pressable>
          ) : null}

          {error ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => router.push('/(tabs)/add/cover')}>
              <Text style={styles.secondaryBtnText}>Scan εξωφύλλου</Text>
            </Pressable>
          ) : null}

          <ComicBorderCard style={styles.isbnCard}>
            <Text style={styles.isbnTitle}>Χειροκίνητη εισαγωγή UPC / ISBN</Text>
            <TextInput
              style={styles.input}
              placeholder="π.χ. 759606095582"
              placeholderTextColor={theme.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
              keyboardType="numeric"
              returnKeyType="search"
              onSubmitEditing={() => manualCode.trim() && void lookup(manualCode)}
            />
            <Pressable
              style={[styles.primaryBtn, (busy || !manualCode.trim()) && styles.btnDisabled]}
              disabled={busy || !manualCode.trim()}
              onPress={() => void lookup(manualCode)}>
              {busy ? (
                <ActivityIndicator color={theme.surface} />
              ) : (
                <Text style={styles.primaryBtnText}>Αναζήτηση στον κατάλογο</Text>
              )}
            </Pressable>
          </ComicBorderCard>
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    width: '100%',
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  cameraCard: {
    height: 280,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: { width: '100%', height: '100%' },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#000a',
  },
  scannedText: {
    color: theme.surface,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  frameOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '82%',
    height: 110,
    borderWidth: 3,
    borderColor: theme.kirbyBlue,
    backgroundColor: 'transparent',
  },
  frameHint: {
    position: 'absolute',
    bottom: 10,
    color: theme.surface,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: '#000a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '92%',
    textAlign: 'center',
  },
  permBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    backgroundColor: '#111',
  },
  permText: { color: theme.surface, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  webBanner: {
    backgroundColor: theme.kirbyBlue,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    padding: 14,
    gap: 6,
  },
  webBannerTitle: { fontSize: 14, fontWeight: '900', color: theme.surface },
  webBannerSub: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.surface,
    opacity: 0.9,
    lineHeight: 18,
  },
  isbnCard: { padding: 14, gap: 10 },
  isbnTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    backgroundColor: theme.background,
  },
  primaryBtn: {
    backgroundColor: theme.kirbyBlue,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: { color: theme.surface, fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: { color: theme.text, fontSize: 13, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  error: { color: theme.kirbyRed, fontSize: 12, fontWeight: '800' },
});
