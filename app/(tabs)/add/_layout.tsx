import { Stack } from 'expo-router';

export default function AddLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="cover" />
      <Stack.Screen name="cover-results" />
      <Stack.Screen name="barcode" />
      <Stack.Screen name="manual" />
    </Stack>
  );
}
