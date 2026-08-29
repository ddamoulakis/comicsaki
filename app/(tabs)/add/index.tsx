import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { KirbyBurst } from '@/components/comicsaki/KirbyBurst';
import { KirbyText } from '@/components/comicsaki/KirbyText';
import { theme } from '@/constants/Theme';

type Method = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  route: string;
  burst?: boolean;
};

const METHODS: Method[] = [
  {
    id: 'barcode',
    title: 'Barcode Scan',
    subtitle: 'UPC/ISBN → Metron, χωρίς AI (πιο ακριβές)',
    icon: 'barcode',
    accentColor: theme.kirbyBlue,
    route: '/(tabs)/add/barcode',
    burst: true,
  },
  {
    id: 'cover',
    title: 'Scan Εξωφύλλου',
    subtitle: 'Φωτο → Gemini → κατάλογος (Metron / Comicsάκι)',
    icon: 'camera',
    accentColor: theme.kirbyMagenta,
    route: '/(tabs)/add/cover',
  },
  {
    id: 'manual',
    title: 'Προσθήκη Χειροκίνητα',
    subtitle: 'Συμπλήρωσε μόνος σου τα στοιχεία του κόμικ',
    icon: 'pencil',
    accentColor: theme.kirbyOrange,
    route: '/(tabs)/add/manual',
  },
];

export default function AddScreen() {
  const router = useRouter();

  return (
    <CosmicBackground variant="flare">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>ΠΡΟΣΘΗΚΗ</Text>
            <Text style={styles.headerSub}>Πώς θέλεις να καταχωρίσεις το κόμικ;</Text>
          </View>

          <View style={styles.methods}>
            {METHODS.map((method) => (
              <Pressable
                key={method.id}
                onPress={() => router.push(method.route as any)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <View style={[styles.cardAccent, { backgroundColor: method.accentColor }]} />
                <View style={styles.cardBody}>
                  <View style={[styles.iconWrap, { backgroundColor: method.accentColor }]}>
                    <Ionicons name={method.icon} size={28} color={theme.surface} />
                    {method.burst ? (
                      <KirbyBurst
                        size={14}
                        color={theme.kirbyYellow}
                        style={styles.burst}
                      />
                    ) : null}
                  </View>
                  <View style={styles.textWrap}>
                    <Text style={styles.methodTitle}>{method.title}</Text>
                    <Text style={styles.methodSub}>{method.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={theme.textMuted} />
                </View>
              </Pressable>
            ))}
          </View>

          <KirbyText variant="body" color="rgba(255,255,255,0.85)" style={styles.hint}>
            Συμβουλή: το Scan Εξωφύλλου δουλεύει καλύτερα σε κινητό με Expo Go.
          </KirbyText>
        </ScrollView>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 18,
    width: '100%',
  },
  header: { gap: 6 },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.kirbyYellow,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  methods: { gap: 14 },
  card: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    shadowColor: theme.border,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardPressed: {
    shadowOffset: { width: 2, height: 2 },
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  cardAccent: {
    width: 6,
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.border,
  },
  burst: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  textWrap: { flex: 1, gap: 3 },
  methodTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.text,
  },
  methodSub: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
    lineHeight: 17,
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
});
