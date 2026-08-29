import { Platform } from 'react-native';

import { requireSupabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  display_name: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type SellerRatingStats = {
  avg_score: number;
  review_count: number;
};

export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.display_name?.trim() &&
      profile.city?.trim() &&
      profile.country?.trim(),
  );
}

export function formatProfileArea(profile: UserProfile | null | undefined): string | null {
  if (!profile?.city?.trim()) return null;
  const city = profile.city.trim();
  const country = profile.country?.trim() || 'Ελλάδα';
  return `${city}, ${country}`;
}

export async function fetchOwnProfile(): Promise<UserProfile | null> {
  const supabase = requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, city, country, avatar_url, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  return (data as UserProfile | null) ?? null;
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, city, country, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as UserProfile | null) ?? null;
}

export async function fetchProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
  const map = new Map<string, UserProfile>();
  if (userIds.length === 0) return map;

  const supabase = requireSupabase();
  const uniqueIds = [...new Set(userIds)];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, city, country, avatar_url, created_at')
    .in('id', uniqueIds);

  if (error) throw error;
  for (const row of (data ?? []) as UserProfile[]) {
    map.set(row.id, row);
  }
  return map;
}

export async function uploadAvatarImage(localUri: string): Promise<string> {
  const supabase = requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const rawExt = localUri.split('?')[0]?.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ext = rawExt === 'png' || rawExt === 'webp' || rawExt === 'jpeg' ? rawExt : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const fileName = `avatars/${user.id}/${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;

  let uploadData: Uint8Array | Blob;

  if (Platform.OS === 'web') {
    const res = await fetch(localUri);
    uploadData = await res.blob();
  } else {
    const FileSystem = await import('expo-file-system/legacy');
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    uploadData = bytes;
  }

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(fileName, uploadData, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Upload: ${error.message}`);

  const { data } = supabase.storage.from('listing-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function upsertOwnProfile(input: {
  displayName: string;
  city: string;
  country: string;
  avatarUrl?: string | null;
}): Promise<UserProfile> {
  const supabase = requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const payload: {
    display_name: string;
    city: string;
    country: string;
    avatar_url?: string | null;
  } = {
    display_name: input.displayName.trim(),
    city: input.city.trim(),
    country: input.country.trim() || 'Ελλάδα',
  };
  if (input.avatarUrl !== undefined) {
    payload.avatar_url = input.avatarUrl;
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('id, display_name, city, country, avatar_url, created_at')
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message || 'Αποτυχία ενημέρωσης προφίλ.');
  }

  if (updated) return updated as UserProfile;

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: user.id, ...payload })
    .select('id, display_name, city, country, avatar_url, created_at')
    .single();

  if (insertError) {
    throw new Error(insertError.message || 'Αποτυχία δημιουργίας προφίλ.');
  }

  return inserted as UserProfile;
}

export async function updateOwnAvatarUrl(avatarUrl: string | null): Promise<UserProfile> {
  const supabase = requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)
    .select('id, display_name, city, country, avatar_url, created_at')
    .maybeSingle();

  if (error) throw new Error(error.message || 'Αποτυχία ενημέρωσης φωτογραφίας.');
  if (!data) throw new Error('Δεν βρέθηκε προφίλ για ενημέρωση.');
  return data as UserProfile;
}

export async function fetchSellerRatingStats(sellerId: string): Promise<SellerRatingStats> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from('seller_ratings').select('score').eq('seller_id', sellerId);

  if (error) throw error;

  const scores = (data ?? []) as { score: number }[];
  if (scores.length === 0) {
    return { avg_score: 0, review_count: 0 };
  }

  const total = scores.reduce((sum, row) => sum + row.score, 0);
  return {
    avg_score: Math.round((total / scores.length) * 10) / 10,
    review_count: scores.length,
  };
}
