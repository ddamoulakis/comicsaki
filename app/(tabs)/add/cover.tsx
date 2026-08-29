import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { AddScreenHeader } from '@/components/add/AddScreenHeader';
import { ComicBorderCard } from '@/components/comicsaki/ComicBorderCard';
import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { KirbyText } from '@/components/comicsaki/KirbyText';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { theme } from '@/constants/Theme';
import { consumeCoverScanReset, setCoverPhoto, setCoverConfirm, setCoverLookupResult } from '@/lib/coverScanSession';
import { isGeminiConfigured } from '@/lib/env';
import {
  lookupCoverByText,
  enrichGeminiWithCatalog,
  buildMatchFromGemini,
} from '@/services/coverLookup';
import { recognizeComicCover } from '@/services/geminiVision';

function isMobileWebBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function webHasGetUserMedia(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/** Cursor/simple-browser preview is an iframe — getUserMedia is blocked. */
function isEmbeddedWebPreview(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function WebFileCapture({
  capture,
  label,
  disabled,
  buttonStyle,
  textStyle,
  onUri,
}: {
  capture: boolean;
  label: string;
  disabled?: boolean;
  buttonStyle: object;
  textStyle: object;
  onUri: (uri: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture ? 'environment' : undefined}
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          onUri(URL.createObjectURL(file));
        }}
      />
      <Pressable
        style={buttonStyle}
        disabled={disabled}
        onPress={() => inputRef.current?.click()}>
        <Text style={textStyle}>{label}</Text>
      </Pressable>
    </>
  );
}

export default function CoverScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [shutterArmed, setShutterArmed] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [preferNativeCapture, setPreferNativeCapture] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const lookupGenRef = useRef(0);

  const resetScanner = useCallback(() => {
    lookupGenRef.current += 1;
    setPhotoUri(null);
    setCameraReady(false);
    setShutterArmed(false);
    setBusy(false);
    setError(null);
    setPreferNativeCapture(false);
    setShowManualSearch(false);
    setCameraSessionKey((key) => key + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (consumeCoverScanReset()) {
        resetScanner();
      }
    }, [resetScanner]),
  );

  const isWeb = Platform.OS === 'web';
  const isMobileWeb = isMobileWebBrowser();
  const embeddedPreview = isEmbeddedWebPreview();
  const useNativeCapturePrimary = preferNativeCapture || embeddedPreview;
  const liveFacing = isWeb && !isMobileWeb ? 'front' : 'back';

  // Live preview is primary. Hint only — do not switch to ImagePicker (re-prompts camera).
  useEffect(() => {
    if (photoUri || useNativeCapturePrimary || !permission?.granted || embeddedPreview) return;
    const t = setTimeout(() => {
      if (!cameraReady) {
        setError('Αν δεν βλέπεις εικόνα, περίμενε λίγο ή διάλεξε φωτογραφία από τη συλλογή.');
      }
    }, 12000);
    return () => clearTimeout(t);
  }, [photoUri, useNativeCapturePrimary, permission?.granted, cameraReady, embeddedPreview]);

  useEffect(() => {
    if (!cameraReady) {
      setShutterArmed(false);
      return;
    }
    const t = setTimeout(() => setShutterArmed(true), 800);
    return () => clearTimeout(t);
  }, [cameraReady]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (!cancelled) setCameraAvailable(webHasGetUserMedia());
          return;
        }
        const ok = await CameraView.isAvailableAsync();
        if (!cancelled) setCameraAvailable(ok);
      } catch {
        if (!cancelled) setCameraAvailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runLookup = useCallback(
    async (uri: string) => {
      const gen = ++lookupGenRef.current;
      setBusy(true);
      setError(null);
      const watchdog = setTimeout(() => {
        if (gen !== lookupGenRef.current) return;
        setError('Η αναγνώριση άργησε πολύ. Δοκίμασε ξανά ή ανέβασε άλλη φωτογραφία.');
        setBusy(false);
      }, 45000);
      try {
        setCoverPhoto(uri);

        if (!isGeminiConfigured()) {
          if (manualQuery.trim()) {
            const result = await lookupCoverByText(manualQuery, uri);
            if (gen !== lookupGenRef.current) return;
            setCoverLookupResult(result);
            router.push('/(tabs)/add/cover-results');
            return;
          }
          setError('Ρύθμισε Gemini API key ή πληκτρολόγησε τίτλο παρακάτω.');
          return;
        }

        try {
          const gemini = await recognizeComicCover(uri, { market: 'auto' });
          if (gen !== lookupGenRef.current) return;

          const goConfirm = () => {
            setCoverConfirm({
              photoUri: uri,
              title: gemini.series.trim(),
              issue: gemini.issue.trim(),
              publisher: gemini.publisher.trim(),
              year: gemini.year.trim(),
              notes: gemini.notes,
            });
            router.push('/(tabs)/add/cover-confirm');
          };

          if (!gemini.series.trim() || gemini.confidence === 'low') {
            goConfirm();
            return;
          }

          setCoverLookupResult({
            photoUri: uri,
            queryHint: [gemini.series, gemini.issue].filter(Boolean).join(' #'),
            matches: [buildMatchFromGemini(gemini, uri)],
            usedDemo: false,
          });
          router.push('/(tabs)/add/cover-results');

          void enrichGeminiWithCatalog(gemini, uri)
            .then((result) => {
              if (gen !== lookupGenRef.current) return;
              if (!result.matches.length) return;
              setCoverLookupResult(result);
            })
            .catch((e) => {
              console.warn('Catalog enrich failed', e);
            });
          return;
        } catch (e) {
          console.warn('Gemini cover lookup failed', e);
          if (gen !== lookupGenRef.current) return;
          setCoverConfirm({
            photoUri: uri,
            title: manualQuery.trim(),
            issue: '',
            publisher: '',
            year: '',
          });
          router.push('/(tabs)/add/cover-confirm');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Αποτυχία αναγνώρισης.');
      } finally {
        clearTimeout(watchdog);
        if (gen === lookupGenRef.current) setBusy(false);
      }
    },
    [manualQuery, router],
  );

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;
    const result = await requestPermission();
    return !!result.granted;
  };

  const captureFromPreview = async () => {
    if (!cameraRef.current || !cameraReady || busy) return;
    try {
      setBusy(true);
      setError(null);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
        exif: false,
      });
      if (!photo?.uri) {
        setError('Δεν αποθηκεύτηκε η φωτογραφία.');
        setBusy(false);
        return;
      }
      setPhotoUri(photo.uri);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Αποτυχία λήψης.');
      setBusy(false);
    }
  };

  const captureWithDeviceCamera = async () => {
    if (busy) return;
    setError(null);
    if (isWeb && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (isMobileWeb) input.setAttribute('capture', 'environment');
      input.onchange = () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;
        setPhotoUri(URL.createObjectURL(file));
      };
      input.click();
      return;
    }
    try {
      // expo-camera grant is enough — don't re-prompt via ImagePicker.
      if (!permission?.granted) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          setError('Χρειάζεται άδεια κάμερας για τη λήψη.');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType: ImagePicker.CameraType.back,
        quality: 0.85,
        allowsEditing: false,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setPhotoUri(result.assets[0].uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Αποτυχία ανοίγματος κάμερας.');
    }
  };

  const pickFromGallery = async () => {
    if (busy) return;
    setError(null);
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libPerm.granted) {
      setError('Χρειάζεται άδεια για πρόσβαση στις φωτογραφίες.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [2, 3],
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    await runLookup(uri);
  };

  const retake = () => {
    resetScanner();
  };

  const searchByText = async () => {
    if (!manualQuery.trim()) {
      setError('Γράψε τίτλο, σειρά ή ISBN για βοήθεια στο match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await lookupCoverByText(manualQuery);
      setCoverLookupResult(result);
      router.push('/(tabs)/add/cover-results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Αποτυχία αναζήτησης.');
    } finally {
      setBusy(false);
    }
  };

  if (cameraAvailable === null || !permission) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={theme.kirbyMagenta} size="large" />
      </View>
    );
  }

  const showLivePreview =
    !useNativeCapturePrimary && !!cameraAvailable && !photoUri && !!permission?.granted;
  const canUseLiveCapture = !!permission?.granted && cameraReady && shutterArmed && !busy;
  const fullscreenScan = !photoUri;

  // ── Fullscreen κάμερα (όπως LoCG) ──────────────────────────────────────────
  if (fullscreenScan) {
    return (
      <View style={styles.fullRoot}>
        {useNativeCapturePrimary ? (
          <View style={styles.permissionBox}>
            <Text style={styles.cameraHeroIcon}>📷</Text>
            <KirbyText variant="body" style={styles.permissionText}>
              {embeddedPreview
                ? 'Η live κάμερα δεν δουλεύει στο preview. Άνοιξε την ίδια σελίδα σε Chrome στο τάμπλετ, ή διάλεξε φωτογραφία εδώ.'
                : 'Πάτα για να ανοίξει η κάμερα της συσκευής, ή διάλεξε φωτογραφία από τη συλλογή.'}
            </KirbyText>
            {isWeb ? (
              <WebFileCapture
                capture={isMobileWeb}
                label={isMobileWeb ? 'Άνοιγμα κάμερας' : 'Επιλογή φωτογραφίας'}
                disabled={busy}
                buttonStyle={styles.permBtn}
                textStyle={styles.permBtnText}
                onUri={setPhotoUri}
              />
            ) : (
              <Pressable
                style={styles.permBtn}
                disabled={busy}
                onPress={captureWithDeviceCamera}>
                <Text style={styles.permBtnText}>Άνοιγμα κάμερας</Text>
              </Pressable>
            )}
            {isWeb ? (
              <WebFileCapture
                capture={false}
                label="Από συλλογή"
                disabled={busy}
                buttonStyle={styles.secondaryWebBtn}
                textStyle={styles.secondaryWebBtnText}
                onUri={setPhotoUri}
              />
            ) : (
              <Pressable style={styles.secondaryWebBtn} disabled={busy} onPress={pickFromGallery}>
                <Text style={styles.secondaryWebBtnText}>Από συλλογή</Text>
              </Pressable>
            )}
          </View>
        ) : !cameraAvailable ? (
          <View style={styles.permissionBox}>
            <KirbyText variant="body" style={styles.permissionText}>
              Δεν βρέθηκε κάμερα σε αυτή τη συσκευή.
            </KirbyText>
            <Text style={styles.permissionHint}>Ανέβασε φωτογραφία από τη συλλογή.</Text>
          </View>
        ) : !permission?.granted ? (
          <View style={styles.permissionBox}>
            <KirbyText variant="body" style={styles.permissionText}>
              Πάτα παρακάτω για να επιτρέψεις την κάμερα.
            </KirbyText>
            <Pressable
              style={styles.permBtn}
              onPress={async () => {
                setCameraReady(false);
                const ok = await ensureCameraPermission();
                if (!ok) {
                  setError(
                    'Η άδεια κάμερας απορρίφθηκε. Επίτρεψέ την από τις ρυθμίσεις του browser.',
                  );
                } else {
                  setError(null);
                }
              }}>
              <Text style={styles.permBtnText}>Να επιτραπεί η κάμερα</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            key={`live-camera-full-${cameraSessionKey}`}
            ref={cameraRef}
            style={styles.fullCamera}
            facing={liveFacing}
            mode="picture"
            animateShutter={false}
            barcodeScannerEnabled={false}
            onCameraReady={() => {
              setCameraReady(true);
              setError(null);
            }}
            onMountError={(e) => {
              setCameraReady(false);
              setError(
                e?.message
                  ? `${e.message} — δοκίμασε ξανά ή διάλεξε φωτογραφία.`
                  : 'Αποτυχία live κάμερας. Δοκίμασε ξανά ή διάλεξε φωτογραφία.',
              );
            }}
          />
        )}

        {/* Top chrome */}
        <SafeAreaView style={styles.fullTop} edges={['top']} pointerEvents="box-none">
          <View style={styles.fullTopRow}>
            <Pressable
              style={styles.chromeBtn}
              onPress={() => router.back()}
              hitSlop={12}>
              <Text style={styles.chromeBtnText}>←</Text>
            </Pressable>
            <Text style={styles.fullTitle}>Cover Scanner</Text>
            <Pressable
              style={[styles.chromeUploadBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={pickFromGallery}
              hitSlop={12}>
              <Text style={styles.chromeUploadBtnText}>+</Text>
            </Pressable>
          </View>
        </SafeAreaView>

        {showLivePreview ? (
          <View style={styles.frameOverlay} pointerEvents="none">
            <View style={styles.frame} />
          </View>
        ) : null}

        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="large" color={theme.kirbyYellow} />
            <Text style={styles.busyText}>Αναγνώριση εξωφύλλου…</Text>
          </View>
        ) : null}

        {/* Bottom controls */}
        <View
          style={[
            styles.fullBottom,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}>
          {error ? <Text style={styles.fullError}>{error}</Text> : null}

          <View style={styles.shutterRow}>
            <Pressable
              style={styles.sideBtn}
              disabled={busy}
              onPress={() => setShowManualSearch((v) => !v)}>
              <Text style={styles.sideBtnText}>Aa</Text>
            </Pressable>

            {showLivePreview ? (
              <Pressable
                style={[styles.shutter, !canUseLiveCapture && styles.btnDisabled]}
                disabled={!canUseLiveCapture}
                onPress={captureFromPreview}>
                <View style={styles.shutterInner} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.shutter, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={
                  !permission?.granted
                    ? ensureCameraPermission
                    : captureWithDeviceCamera
                }>
                <View style={styles.shutterInner} />
              </Pressable>
            )}

            <Pressable style={styles.sideBtn} disabled={busy} onPress={pickFromGallery}>
              <Text style={styles.sideBtnText}>▢</Text>
            </Pressable>
          </View>

          {!showLivePreview && cameraAvailable && permission?.granted ? (
            <Pressable
              style={styles.altCapture}
              disabled={busy}
              onPress={captureWithDeviceCamera}>
              <Text style={styles.altCaptureText}>📷 Κάμερα συσκευής</Text>
            </Pressable>
          ) : null}

          {isWeb && isMobileWeb ? (
            <Text style={styles.powered}>Καλύτερη ποιότητα σε πλήρη οθόνη · Chrome</Text>
          ) : (
            <Text style={styles.powered}>Πλήρης οθόνη για καλύτερη ποιότητα</Text>
          )}

          {showManualSearch ? (
            <View style={styles.manualSheet}>
              <TextInput
                style={styles.input}
                placeholder="Τίτλος / ISBN για βοήθεια"
                placeholderTextColor="#aaa"
                value={manualQuery}
                onChangeText={setManualQuery}
                onSubmitEditing={searchByText}
                returnKeyType="search"
              />
              <Pressable
                style={[styles.permBtn, (busy || !manualQuery.trim()) && styles.btnDisabled]}
                disabled={busy || !manualQuery.trim()}
                onPress={searchByText}>
                <Text style={styles.permBtnText}>Αναζήτηση</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Μετά τη λήψη: preview + επανάληψη ──────────────────────────────────────
  return (
    <CosmicBackground variant="flare">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <AddScreenHeader
            title="SCAN ΕΞΩΦΥΛΛΟΥ"
            subtitle="Έλεγχος φωτογραφίας πριν την αναζήτηση."
          />

          <View style={styles.cameraCard}>
            {photoUri ? (
              <ZoomableCover uri={photoUri} style={styles.preview} resizeMode="cover" />
            ) : null}
            {busy ? (
              <View style={styles.busyOverlay}>
                <ActivityIndicator size="large" color={theme.kirbyYellow} />
                <Text style={styles.busyText}>Αναγνώριση εξωφύλλου…</Text>
              </View>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => photoUri && runLookup(photoUri)}>
              {busy ? (
                <ActivityIndicator color={theme.surface} />
              ) : (
                <Text style={styles.primaryBtnText}>Αναζήτηση matches</Text>
              )}
            </Pressable>
            <Pressable style={styles.secondaryBtn} disabled={busy} onPress={retake}>
              <Text style={styles.secondaryBtnText}>Νέα λήψη</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} disabled={busy} onPress={pickFromGallery}>
              <Text style={styles.secondaryBtnText}>Από συλλογή φωτογραφιών</Text>
            </Pressable>
          </View>

          <ComicBorderCard style={styles.helpCard}>
            <Text style={styles.helpTitle}>Αναζήτηση με τίτλο / ISBN</Text>
            <TextInput
              style={styles.inputDark}
              placeholder="π.χ. Spider-Man 112 / Μπλεκ 8 / ISBN"
              placeholderTextColor={theme.textMuted}
              value={manualQuery}
              onChangeText={setManualQuery}
              onSubmitEditing={searchByText}
              returnKeyType="search"
            />
            <Pressable
              style={[styles.primaryBtn, (busy || !manualQuery.trim()) && styles.btnDisabled]}
              disabled={busy || !manualQuery.trim()}
              onPress={searchByText}>
              {busy ? (
                <ActivityIndicator color={theme.surface} />
              ) : (
                <Text style={styles.primaryBtnText}>Αναζήτηση</Text>
              )}
            </Pressable>
          </ComicBorderCard>
        </ScrollView>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullCamera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  fullTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  fullTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fullTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chromeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0008',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromeBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  chromeUploadBtn: {
    minWidth: 48,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 12,
    backgroundColor: theme.kirbyYellow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chromeUploadBtnText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: -4,
    lineHeight: 34,
  },
  fullBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'transparent',
    gap: 10,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0004',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#0008',
    borderWidth: 1,
    borderColor: '#fff6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  altCapture: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  altCaptureText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  powered: {
    textAlign: 'center',
    color: '#ffffffaa',
    fontSize: 11,
    fontWeight: '600',
  },
  fullError: {
    color: theme.kirbyYellow,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: '#000a',
    padding: 8,
  },
  manualSheet: {
    gap: 8,
    backgroundColor: '#000c',
    padding: 12,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#fff4',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#111',
  },
  inputDark: {
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    backgroundColor: theme.background,
  },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 12,
    width: '100%',
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
  },
  cameraCard: {
    height: 360,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111',
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
  },
  preview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  permissionBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
    backgroundColor: '#111',
  },
  permissionText: {
    color: theme.surface,
    textAlign: 'center',
  },
  permissionHint: {
    color: theme.surface,
    opacity: 0.8,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  cameraHeroIcon: {
    fontSize: 42,
    marginBottom: 4,
  },
  permBtn: {
    backgroundColor: theme.kirbyMagenta,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  permBtnText: {
    color: theme.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryWebBtn: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryWebBtnText: {
    color: theme.cosmicInk,
    fontSize: 13,
    fontWeight: '900',
  },
  frameOverlay: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    bottom: 8,
    zIndex: 2,
  },
  frame: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'transparent',
  },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0009',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 5,
  },
  busyText: {
    color: theme.surface,
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: theme.kirbyMagenta,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    color: theme.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryBtn: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  error: {
    color: theme.kirbyRed,
    fontSize: 12,
    fontWeight: '800',
  },
  helpCard: {
    padding: 14,
    gap: 10,
  },
  helpTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: theme.text,
    textTransform: 'uppercase',
  },
});
