import { Platform } from 'react-native';

import { requireSupabase } from '@/lib/supabase';

export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number | null;
  cover_url: string | null;
  condition: string;
  is_active: boolean;
  created_at: string;
};

export type SellerMessage = {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id?: string;
  body: string;
  created_at: string;
  listing?: { title?: string | null; cover_url?: string | null } | null;
};

export type ListingMessage = {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

export type ListingConversationPeer = {
  otherUserId: string;
  lastBody: string;
  lastAt: string;
  listingId: string;
  listingTitle: string | null;
};

/** Μία συνομιλία = μία αγγελία + ένας συνομιλητής (όχι κάθε μήνυμα ξεχωριστά). */
export type InboxConversation = {
  key: string;
  listingId: string;
  listingTitle: string | null;
  listingCoverUrl: string | null;
  otherUserId: string;
  lastBody: string;
  lastAt: string;
  messageCount: number;
};

export function groupMessagesIntoConversations(
  messages: SellerMessage[],
  myUserId: string,
): InboxConversation[] {
  const map = new Map<string, InboxConversation>();
  // messages expected newest-first
  for (const m of messages) {
    const otherUserId =
      m.sender_id === myUserId ? String(m.recipient_id ?? '') : m.sender_id;
    if (!otherUserId) continue;
    const key = `${m.listing_id}:${otherUserId}`;
    const existing = map.get(key);
    if (existing) {
      existing.messageCount += 1;
      continue;
    }
    map.set(key, {
      key,
      listingId: m.listing_id,
      listingTitle: m.listing?.title ?? null,
      listingCoverUrl: m.listing?.cover_url ?? null,
      otherUserId,
      lastBody: m.body,
      lastAt: m.created_at,
      messageCount: 1,
    });
  }
  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export type SellerReport = {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  listing?: { title?: string | null; cover_url?: string | null } | null;
};

export async function uploadListingImage(localUri: string): Promise<string> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const fileName = `${user.id}/${Date.now()}.${ext}`;

  let uploadData: Uint8Array | Blob;

  if (Platform.OS === 'web') {
    // Web: fetch as blob directly
    const res = await fetch(localUri);
    uploadData = await res.blob();
  } else {
    // Native: use expo-file-system/legacy
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

const LISTING_SELECT =
  'id, user_id, title, description, price, cover_url, condition, is_active, created_at';
const LISTING_SELECT_LEGACY =
  'id, user_id, title, description, price, cover_url, condition, created_at';

function normalizeListing(row: Listing): Listing {
  return { ...row, is_active: row.is_active !== false };
}

function isMissingIsActiveColumn(error: { message?: string } | null | undefined) {
  return /is_active/i.test(error?.message ?? '');
}

export async function fetchRecentListings(limit = 10): Promise<Listing[]> {
  const supabase = requireSupabase();
  const primary = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!primary.error) {
    return ((primary.data ?? []) as Listing[]).map(normalizeListing);
  }
  if (!isMissingIsActiveColumn(primary.error)) throw primary.error;

  const fallback = await supabase
    .from('listings')
    .select(LISTING_SELECT_LEGACY)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (fallback.error) throw fallback.error;
  return ((fallback.data ?? []) as Listing[]).map(normalizeListing);
}

export async function fetchMyListings(limit = 50): Promise<Listing[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const primary = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!primary.error) {
    return ((primary.data ?? []) as Listing[]).map(normalizeListing);
  }
  if (!isMissingIsActiveColumn(primary.error)) throw primary.error;

  const fallback = await supabase
    .from('listings')
    .select(LISTING_SELECT_LEGACY)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (fallback.error) throw fallback.error;
  return ((fallback.data ?? []) as Listing[]).map(normalizeListing);
}

export async function createListing(
  listing: Omit<Listing, 'id' | 'user_id' | 'created_at' | 'is_active'> & { is_active?: boolean },
): Promise<Listing> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος για να δημοσιεύσεις αγγελία.');
  const payload = { ...listing, user_id: user.id, is_active: listing.is_active ?? true };
  const primary = await supabase.from('listings').insert(payload).select(LISTING_SELECT).single();
  if (!primary.error) return normalizeListing(primary.data as Listing);
  if (!isMissingIsActiveColumn(primary.error)) throw primary.error;

  const { is_active: _ignored, ...legacy } = payload;
  const fallback = await supabase.from('listings').insert(legacy).select(LISTING_SELECT_LEGACY).single();
  if (fallback.error) throw fallback.error;
  return normalizeListing(fallback.data as Listing);
}

export async function updateListing(
  id: string,
  listing: Omit<Listing, 'id' | 'user_id' | 'created_at'>,
): Promise<Listing> {
  const supabase = requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const updatePayload = {
    title: listing.title,
    description: listing.description,
    price: listing.price,
    cover_url: listing.cover_url,
    condition: listing.condition,
    is_active: listing.is_active,
  };

  const primary = await supabase
    .from('listings')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(LISTING_SELECT)
    .single();

  if (!primary.error) return normalizeListing(primary.data as Listing);
  if (!isMissingIsActiveColumn(primary.error)) throw primary.error;

  const { is_active: _ignored, ...legacyUpdate } = updatePayload;
  const fallback = await supabase
    .from('listings')
    .update(legacyUpdate)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(LISTING_SELECT_LEGACY)
    .single();
  if (fallback.error) throw fallback.error;
  return normalizeListing(fallback.data as Listing);
}

export async function deleteListing(id: string): Promise<void> {
  const supabase = requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const { error } = await supabase.from('listings').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function sendListingMessage(input: {
  listingId: string;
  recipientId: string;
  body: string;
}): Promise<ListingMessage> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος για μήνυμα.');
  if (user.id === input.recipientId) throw new Error('Δεν μπορείς να στείλεις μήνυμα στον εαυτό σου.');
  const body = input.body.trim();
  if (!body) throw new Error('Γράψε το μήνυμά σου.');

  const { data, error } = await supabase
    .from('listing_messages')
    .insert({
      listing_id: input.listingId,
      sender_id: user.id,
      recipient_id: input.recipientId,
      body,
    })
    .select('id, listing_id, sender_id, recipient_id, body, created_at')
    .single();

  if (error) throw error;
  return data as ListingMessage;
}

export async function fetchListingConversation(
  listingId: string,
  otherUserId: string,
): Promise<ListingMessage[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const { data, error } = await supabase
    .from('listing_messages')
    .select('id, listing_id, sender_id, recipient_id, body, created_at')
    .eq('listing_id', listingId)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as ListingMessage[]).filter(
    (m) =>
      (m.sender_id === user.id && m.recipient_id === otherUserId) ||
      (m.sender_id === otherUserId && m.recipient_id === user.id),
  );
}

export async function fetchListingPeers(listingId: string): Promise<ListingConversationPeer[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const { data, error } = await supabase
    .from('listing_messages')
    .select('id, listing_id, sender_id, recipient_id, body, created_at, listing:listings(title)')
    .eq('listing_id', listingId)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const peers = new Map<string, ListingConversationPeer>();
  for (const row of data ?? []) {
    const msg = row as SellerMessage & { recipient_id: string };
    const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    if (!otherUserId || peers.has(otherUserId)) continue;
    peers.set(otherUserId, {
      otherUserId,
      lastBody: msg.body,
      lastAt: msg.created_at,
      listingId: msg.listing_id,
      listingTitle: msg.listing?.title ?? null,
    });
  }
  return [...peers.values()];
}

export async function createListingReport(
  input: { listingId: string; reason?: string | null; details?: string | null },
): Promise<void> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος για αναφορά.');
  const { error } = await supabase.from('listing_reports').insert({
    listing_id: input.listingId,
    reporter_id: user.id,
    reason: input.reason ?? 'general',
    details: input.details ?? null,
  });
  if (error) throw error;
}

export async function fetchSellerInbox(limit = 30): Promise<{
  messages: SellerMessage[];
  reports: SellerReport[];
}> {
  const supabase = requireSupabase();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const myListingIds =
    (
      await supabase.from('listings').select('id').eq('user_id', user.id)
    ).data?.map((r: { id: string }) => r.id) ?? [];

  const [messagesRes, reportsRes] = await Promise.all([
    supabase
      .from('listing_messages')
      .select('id, listing_id, sender_id, recipient_id, body, created_at, listing:listings(title, cover_url)')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 4, 80)),
    myListingIds.length > 0
      ? supabase
          .from('listing_reports')
          .select('id, listing_id, reporter_id, reason, details, status, created_at, listing:listings(title, cover_url)')
          .in('listing_id', myListingIds)
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as SellerReport[], error: null }),
  ]);

  if (messagesRes.error) throw messagesRes.error;
  if (reportsRes.error) throw reportsRes.error;

  return {
    messages: (messagesRes.data ?? []) as SellerMessage[],
    reports: (reportsRes.data ?? []) as SellerReport[],
  };
}

/** Incoming messages addressed to the current user, optionally only those after `sinceIso`. */
export async function fetchIncomingMessageCount(sinceIso?: string | null): Promise<number> {
  const supabase = requireSupabase();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) return 0;

  let query = supabase
    .from('listing_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id);

  if (sinceIso) {
    query = query.gt('created_at', sinceIso);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
