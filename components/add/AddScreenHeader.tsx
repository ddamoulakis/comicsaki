import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { KirbyText } from '@/components/comicsaki/KirbyText';
import { theme } from '@/constants/Theme';

type AddScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
};

export function AddScreenHeader({ title, subtitle, showBack = true, onBack }: AddScreenHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable onPress={handleBack} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={theme.kirbyYellow} />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <KirbyText variant="title" color={theme.kirbyYellow} style={styles.title}>
        {title}
      </KirbyText>
      {subtitle ? (
        <KirbyText variant="body" color={theme.kirbyYellow} style={styles.subtitle}>
          {subtitle}
        </KirbyText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    marginBottom: 4,
  },
  back: {
    alignSelf: 'flex-start',
    marginLeft: -4,
    marginBottom: 2,
  },
  backSpacer: {
    height: 4,
  },
  title: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
