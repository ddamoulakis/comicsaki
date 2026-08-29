export const env = {
  appUrl: process.env.EXPO_PUBLIC_APP_URL ?? '',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  googleVisionKey: process.env.EXPO_PUBLIC_GOOGLE_VISION_KEY ?? '',
  metronUser: process.env.EXPO_PUBLIC_METRON_USER ?? '',
  metronPass: process.env.EXPO_PUBLIC_METRON_PASS ?? '',
  geminiKey: process.env.EXPO_PUBLIC_GEMINI_KEY ?? '',
  greekcomicsCoversBase: process.env.EXPO_PUBLIC_GREEKCOMICS_COVERS_BASE ?? '',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isMetronConfigured(): boolean {
  return Boolean(env.metronUser && env.metronPass);
}

export function isGeminiConfigured(): boolean {
  return Boolean(env.geminiKey);
}
