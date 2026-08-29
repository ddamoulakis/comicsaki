import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/Theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Δεν βρέθηκε' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Αυτή η οθόνη δεν υπάρχει.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Πίσω στην αρχική</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.text,
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.kirbyMagenta,
  },
});
