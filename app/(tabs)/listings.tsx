import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { ShellModal } from '@/components/comicsaki/ShellModal';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { ShareSheet, buildShareUrl, shareWithSystem, type SharePayload } from '@/components/ShareSheet';
import { theme } from '@/constants/Theme';
import { getTabBarHeight } from '@/constants/phoneShell';
import { useAppViewport } from '@/hooks/useAppViewport';
import { useAuth } from '@/contexts/AuthProvider';
import { useInboxBadge } from '@/contexts/InboxBadgeProvider';
import { fetchListingFavoriteIds, isListingFavorite, toggleListingFavorite } from '@/services/listingFavorites';
import {
  fetchSavedListingSearches,
  isListingSearchSaved,
  removeSavedListingSearch,
  saveListingSearch,
  type SavedListingSearch,
} from '@/services/savedListingSearches';
import {
  fetchRecentListings,
  fetchMyListings,
  createListing,
  updateListing,
  deleteListing,
  uploadListingImage,
  sendListingMessage,
  fetchListingConversation,
  fetchListingPeers,
  createListingReport,
  fetchSellerInbox,
  groupMessagesIntoConversations,
  type InboxConversation,
  type SellerReport,
  type Listing,
  type ListingMessage,
  type ListingConversationPeer,
} from '@/services/supabase/listings';
import {
  fetchOwnProfile,
  fetchProfile,
  fetchProfiles,
  fetchSellerRatingStats,
  formatProfileArea,
  isProfileComplete,
  type SellerRatingStats,
  type UserProfile,
} from '@/services/supabase/profile';

const GAP = 8;
const H_PAD = 12;

function getGridMetrics(width: number) {
  const cols = 3;
  const cardW = Math.floor((width - H_PAD * 2 - GAP * (cols - 1)) / cols);
  const coverH = Math.floor(cardW * 1.5);
  const filterPanelW = width < 380 ? width : Math.min(320, width * 0.82);
  return { cols, cardW, coverH, filterPanelW };
}

const CONDITIONS = ['MT', 'NM', 'VF', 'FN', 'VG', 'GD', 'FR', 'PR'];

type ListingSortBy = 'newest' | 'price_asc' | 'price_desc' | 'title';
type ListingPriceMode = 'all' | 'priced' | 'unpriced';
type ListingFilters = {
  showActive: boolean;
  sortBy: ListingSortBy;
  conditions: Set<string>;
  priceMode: ListingPriceMode;
};

const DEFAULT_LISTING_FILTERS: ListingFilters = {
  showActive: true,
  sortBy: 'newest',
  conditions: new Set(),
  priceMode: 'all',
};

function cloneListingFilters(f: ListingFilters): ListingFilters {
  return {
    showActive: f.showActive,
    sortBy: f.sortBy,
    conditions: new Set(f.conditions),
    priceMode: f.priceMode,
  };
}

type ListingFilterSection = 'sort' | 'condition' | 'price' | null;

function ListingFilterPanel({
  visible,
  filters,
  panelWidth,
  onClose,
  onApply,
}: {
  visible: boolean;
  filters: ListingFilters;
  panelWidth: number;
  onClose: () => void;
  onApply: (f: ListingFilters) => void;
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets.bottom);
  const [local, setLocal] = useState<ListingFilters>(() => cloneListingFilters(filters));
  const [openSection, setOpenSection] = useState<ListingFilterSection>(null);
  const [mounted, setMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!visible) slideAnim.setValue(panelWidth);
  }, [panelWidth, slideAnim, visible]);

  useEffect(() => {
    if (visible) {
      setLocal(cloneListingFilters(filters));
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: false,
      }).start();
      return;
    }

    Animated.timing(slideAnim, {
      toValue: panelWidth,
      duration: 240,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        setOpenSection(null);
      }
    });
  }, [visible, slideAnim, panelWidth, filters]);

  if (!mounted) return null;

  const SectionHeader = ({
    id,
    label,
    badge,
  }: {
    id: ListingFilterSection;
    label: string;
    badge?: number;
  }) => {
    const open = openSection === id;
    return (
      <Pressable
        style={[styles.sectionHeader, open && styles.sectionHeaderOpen]}
        onPress={() => setOpenSection(open ? null : id)}>
        <Text style={styles.sectionHeaderText}>{label}</Text>
        {badge ? (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={open ? theme.kirbyMagenta : theme.textMuted}
          style={{ marginLeft: 'auto' }}
        />
      </Pressable>
    );
  };

  const Radio = ({ selected }: { selected: boolean }) => (
    <View style={[styles.radio, selected && styles.radioActive]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );

  const sortOptions: { key: ListingSortBy; label: string }[] = [
    { key: 'newest', label: 'Νεότερα πρώτα' },
    { key: 'price_asc', label: 'Τιμή ↑' },
    { key: 'price_desc', label: 'Τιμή ↓' },
    { key: 'title', label: 'Τίτλος Α–Ω' },
  ];

  const priceOptions: { key: ListingPriceMode; label: string }[] = [
    { key: 'all', label: 'Όλες' },
    { key: 'priced', label: 'Με τιμή' },
    { key: 'unpriced', label: 'Χωρίς τιμή' },
  ];

  return (
    <View style={[styles.filterModalRoot, { bottom: tabBarHeight }]} pointerEvents="box-none">
      <Pressable style={styles.filterOverlay} onPress={onClose} />
      <Animated.View
        style={[
          styles.filterPanel,
          { width: panelWidth, paddingTop: Math.max(insets.top, 12), transform: [{ translateX: slideAnim }] },
        ]}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>ΦΙΛΤΡΑ</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.statusToggleRow}>
            <View style={styles.statusToggleTextWrap}>
              <Text style={styles.statusToggleTitle}>
                {local.showActive ? 'Ενεργές αγγελίες' : 'Ανενεργές αγγελίες'}
              </Text>
              <Text style={styles.statusToggleHint}>
                {local.showActive ? 'Εμφάνιση ενεργών' : 'Εμφάνιση ανενεργών'}
              </Text>
            </View>
            <Switch
              value={local.showActive}
              onValueChange={(value) => setLocal((p) => ({ ...p, showActive: value }))}
              trackColor={{ false: '#C9C9C9', true: theme.kirbyMagenta }}
              thumbColor={theme.surface}
            />
          </View>

          <SectionHeader id="sort" label="ΤΑΞΙΝΟΜΗΣΗ" badge={local.sortBy !== 'newest' ? 1 : 0} />
          {openSection === 'sort'
            ? sortOptions.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={styles.filterRow}
                  onPress={() => setLocal((p) => ({ ...p, sortBy: opt.key }))}>
                  <Radio selected={local.sortBy === opt.key} />
                  <Text style={[styles.filterLabel, local.sortBy === opt.key && styles.filterLabelActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))
            : null}

          <SectionHeader id="condition" label="ΚΑΤΑΣΤΑΣΗ" badge={local.conditions.size} />
          {openSection === 'condition'
            ? CONDITIONS.map((c) => {
                const selected = local.conditions.has(c);
                return (
                  <Pressable
                    key={c}
                    style={styles.filterRow}
                    onPress={() =>
                      setLocal((p) => {
                        const next = new Set(p.conditions);
                        next.has(c) ? next.delete(c) : next.add(c);
                        return { ...p, conditions: next };
                      })
                    }>
                    <Radio selected={selected} />
                    <Text style={[styles.filterLabel, selected && styles.filterLabelActive]}>{c}</Text>
                  </Pressable>
                );
              })
            : null}

          <SectionHeader id="price" label="ΤΙΜΗ" badge={local.priceMode !== 'all' ? 1 : 0} />
          {openSection === 'price'
            ? priceOptions.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={styles.filterRow}
                  onPress={() => setLocal((p) => ({ ...p, priceMode: opt.key }))}>
                  <Radio selected={local.priceMode === opt.key} />
                  <Text style={[styles.filterLabel, local.priceMode === opt.key && styles.filterLabelActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))
            : null}
        </ScrollView>

        <View style={styles.filterFooter}>
          <Pressable
            style={styles.filterReset}
            onPress={() => setLocal(cloneListingFilters(DEFAULT_LISTING_FILTERS))}>
            <Text style={styles.filterResetText}>Επαναφορά</Text>
          </Pressable>
          <Pressable
            style={styles.filterApply}
            onPress={() => {
              onApply(cloneListingFilters(local));
              onClose();
            }}>
            <Text style={styles.filterApplyText}>Εφαρμογή</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function ListingCard({
  item,
  sellerArea,
  cardW,
  coverH,
  isFavorite,
  isOwn,
  onPress,
  onToggleFavorite,
  onEdit,
  onDelete,
}: {
  item: Listing;
  sellerArea?: string | null;
  cardW: number;
  coverH: number;
  isFavorite: boolean;
  isOwn: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, { width: cardW }]}>
      {item.cover_url ? (
        <ZoomableCover
          uri={item.cover_url}
          style={{ width: cardW, height: coverH }}
          resizeMode="cover"
          caption={item.title}
        />
      ) : (
        <Pressable onPress={onPress}>
          <View style={[{ width: cardW, height: coverH }, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText} numberOfLines={3}>
              {item.title}
            </Text>
          </View>
        </Pressable>
      )}
      <Pressable onPress={onPress}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
        <View style={styles.cardMeta}>
          <View style={styles.condBadge}>
            <Text style={styles.condText}>{item.condition}</Text>
          </View>
          {item.price != null ? (
            <Text style={styles.gridPrice}>€{Number(item.price).toFixed(2)}</Text>
          ) : null}
        </View>
        {sellerArea ? (
          <Text style={styles.cardArea} numberOfLines={1}>
            📍 {sellerArea}
          </Text>
        ) : null}
      </View>
      </Pressable>
      {isOwn ? (
        <View style={[styles.cardOwnerActions, { top: coverH - 36 }]}>
          <Pressable
            style={styles.cardActionBtn}
            hitSlop={6}
            onPress={onEdit}
            accessibilityLabel="Επεξεργασία αγγελίας">
            <Ionicons name="create-outline" size={16} color={theme.cosmicInk} />
          </Pressable>
          <Pressable
            style={styles.cardActionBtn}
            hitSlop={6}
            onPress={onDelete}
            accessibilityLabel="Διαγραφή αγγελίας">
            <Ionicons name="trash-outline" size={16} color={theme.kirbyRed} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.cardHeart, { top: coverH - 36 }]}
          hitSlop={8}
          onPress={onToggleFavorite}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? theme.kirbyRed : theme.cosmicInk}
          />
        </Pressable>
      )}
    </View>
  );
}

export default function ListingsScreen() {
  const router = useRouter();
  const { width } = useAppViewport();
  const { cols, cardW, coverH, filterPanelW } = useMemo(() => getGridMetrics(width), [width]);
  const { listingId, mine, inbox, q, saved } = useLocalSearchParams<{
    listingId?: string;
    mine?: string;
    inbox?: string;
    q?: string;
    saved?: string;
  }>();
  const { user } = useAuth();
  const { markSeen: markInboxSeen } = useInboxBadge();
  const showMineOnly = mine === '1' || mine === 'true';
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatPeerId, setChatPeerId] = useState<string | null>(null);
  const [chatPeerName, setChatPeerName] = useState('Χρήστης');
  const [chatMessages, setChatMessages] = useState<ListingMessage[]>([]);
  const [chatPeers, setChatPeers] = useState<ListingConversationPeer[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [peersVisible, setPeersVisible] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [inboxVisible, setInboxVisible] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [sellerMessages, setSellerMessages] = useState<InboxConversation[]>([]);
  const [sellerReports, setSellerReports] = useState<SellerReport[]>([]);
  const [sellerProfiles, setSellerProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [ownProfile, setOwnProfile] = useState<UserProfile | null>(null);
  const [selectedSellerProfile, setSelectedSellerProfile] = useState<UserProfile | null>(null);
  const [selectedSellerStats, setSelectedSellerStats] = useState<SellerRatingStats | null>(null);
  const [listingFavorite, setListingFavorite] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(typeof q === 'string' ? q : '');
  const [searchSaved, setSearchSaved] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedListingSearch[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ListingFilters>(() =>
    cloneListingFilters(DEFAULT_LISTING_FILTERS),
  );

  // New / edit listing modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [condition, setCondition] = useState('VF');
  const [listingActive, setListingActive] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const fetchFn = showMineOnly ? fetchMyListings(50) : fetchRecentListings(50);
    fetchFn
      .then(async (rows) => {
        setListings(rows);
        try {
          const { fetchProfiles } = await import('@/services/supabase/profile');
          const profiles = await fetchProfiles(rows.map((row) => row.user_id));
          setSellerProfiles(profiles);
        } catch {
          setSellerProfiles(new Map());
        }
      })
      .catch(() => setError(showMineOnly ? 'Αποτυχία φόρτωσης των αγγελιών σου.' : 'Αποτυχία φόρτωσης αγγελιών.'))
      .finally(() => setLoading(false));
  }, [showMineOnly]);

  useFocusEffect(load);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setInboxVisible(false);
        setPeersVisible(false);
        setSavedVisible(false);
        setModalVisible(false);
        setChatVisible(false);
        setSelectedListing(null);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchListingFavoriteIds()
        .then((ids) => {
          if (active) setFavoriteIds(ids);
        })
        .catch(() => {
          if (active) setFavoriteIds(new Set());
        });
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (typeof q === 'string') setSearch(q);
  }, [q]);

  useEffect(() => {
    let active = true;
    isListingSearchSaved(search, showMineOnly).then((savedAlready) => {
      if (active) setSearchSaved(savedAlready);
    });
    return () => {
      active = false;
    };
  }, [search, showMineOnly]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setOwnProfile(null);
        return;
      }
      fetchOwnProfile()
        .then(setOwnProfile)
        .catch(() => setOwnProfile(null));
    }, [user]),
  );

  useEffect(() => {
    if (!selectedListing) {
      setSelectedSellerProfile(null);
      setSelectedSellerStats(null);
      setListingFavorite(false);
      return;
    }

    let cancelled = false;
    isListingFavorite(selectedListing.id)
      .then((fav) => {
        if (!cancelled) setListingFavorite(fav);
      })
      .catch(() => {
        if (!cancelled) setListingFavorite(false);
      });

    Promise.all([
      fetchProfile(selectedListing.user_id),
      fetchSellerRatingStats(selectedListing.user_id),
    ])
      .then(([profile, stats]) => {
        if (cancelled) return;
        setSelectedSellerProfile(profile);
        setSelectedSellerStats(stats);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedSellerProfile(null);
        setSelectedSellerStats(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedListing]);

  useFocusEffect(
    useCallback(() => {
      if (!listingId) return;
      const target = listings.find((l) => l.id === String(listingId));
      if (target) setSelectedListing(target);
    }, [listingId, listings]),
  );

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setLocalImageUri(null);
    setExistingCoverUrl(null);
    setEditingListingId(null);
    setCondition('VF');
    setListingActive(true);
    setFormError(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setFormError('Χρειάζεται πρόσβαση στη βιβλιοθήκη φωτογραφιών.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  };

  const openCreateListing = () => {
    if (!user) {
      notify('Συνδέσου από το Προφίλ για να δημοσιεύσεις αγγελία.');
      router.push('/(tabs)/profile');
      return;
    }
    if (!isProfileComplete(ownProfile)) {
      notify('Συμπλήρωσε όνομα και περιοχή στο Προφίλ πριν δημοσιεύσεις.');
      router.push('/(tabs)/profile');
      return;
    }
    resetForm();
    setModalVisible(true);
  };

  const openEditListing = (item: Listing) => {
    if (!user || item.user_id !== user.id) return;
    setSelectedListing(null);
    setEditingListingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? '');
    setPrice(item.price != null ? String(item.price) : '');
    setCondition(item.condition || 'VF');
    setListingActive(item.is_active !== false);
    setExistingCoverUrl(item.cover_url);
    setLocalImageUri(null);
    setFormError(null);
    setModalVisible(true);
  };

  const confirmDeleteListing = (item: Listing) => {
    if (!user || item.user_id !== user.id) return;
    const runDelete = async () => {
      try {
        await deleteListing(item.id);
        if (selectedListing?.id === item.id) setSelectedListing(null);
        setListings((prev) => prev.filter((row) => row.id !== item.id));
        notify('Η αγγελία διαγράφηκε.');
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Αποτυχία διαγραφής.');
      }
    };

    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm(`Διαγραφή της αγγελίας «${item.title}»;`);
      if (ok) void runDelete();
      return;
    }

    Alert.alert('Διαγραφή αγγελίας', `Θέλεις να διαγράψεις την «${item.title}»;`, [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: () => void runDelete() },
    ]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setFormError('Ο τίτλος είναι υποχρεωτικός.'); return; }
    if (!user) { setFormError('Πρέπει να είσαι συνδεδεμένος.'); return; }
    if (!isProfileComplete(ownProfile)) {
      setFormError('Συμπλήρωσε το προφίλ σου (όνομα + περιοχή) πριν δημοσιεύσεις.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      let cover_url: string | null = existingCoverUrl;
      if (localImageUri) {
        cover_url = await uploadListingImage(localImageUri);
      }
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        price: price ? parseFloat(price.replace(',', '.')) : null,
        cover_url,
        condition,
        is_active: listingActive,
      };
      if (editingListingId) {
        const updated = await updateListing(editingListingId, payload);
        setListings((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        notify('Η αγγελία ενημερώθηκε.');
      } else {
        await createListing(payload);
        notify('Η αγγελία δημοσιεύτηκε.');
        load();
      }
      setModalVisible(false);
      resetForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error('[listing submit]', msg, e);
      setFormError(msg || 'Αποτυχία δημοσίευσης.');
    } finally {
      setSubmitting(false);
    }
  };

  const notify = (message: string) => {
    setActionMsg(message);
    setTimeout(() => setActionMsg(null), 2200);
  };

  const handleSaveSearch = async () => {
    if (!search.trim()) {
      notify('Γράψε πρώτα κάτι στην αναζήτηση.');
      return;
    }
    try {
      const { created } = await saveListingSearch({ query: search, mineOnly: showMineOnly });
      setSearchSaved(true);
      notify(created ? 'Η αναζήτηση αποθηκεύτηκε.' : 'Η αναζήτηση είναι ήδη αποθηκευμένη.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.');
    }
  };

  const applySavedSearch = (item: SavedListingSearch) => {
    setSavedVisible(false);
    setSearch(item.query);
    if (item.mineOnly && !showMineOnly) {
      router.replace({ pathname: '/(tabs)/listings', params: { mine: '1', q: item.query } });
    } else if (!item.mineOnly && showMineOnly) {
      router.replace({ pathname: '/(tabs)/listings', params: { q: item.query } });
    }
  };

  const handleRemoveSavedSearch = async (id: string) => {
    await removeSavedListingSearch(id);
    setSavedSearches((prev) => prev.filter((item) => item.id !== id));
    const stillSaved = await isListingSearchSaved(search, showMineOnly);
    setSearchSaved(stillSaved);
  };

  const openChatWithPeer = async (listing: Listing, peerId: string, peerName?: string) => {
    if (!user) {
      notify('Συνδέσου για να στείλεις μήνυμα.');
      router.push('/(tabs)/profile');
      return;
    }
    if (!peerId || peerId === user.id) {
      notify('Δεν μπορείς να στείλεις μήνυμα στον εαυτό σου.');
      return;
    }

    setSelectedListing(listing);
    setChatPeerId(peerId);
    setChatPeerName(peerName || 'Πωλητής');
    setPeersVisible(false);
    setChatText('');
    setChatMessages([]);
    setChatVisible(true);
    setChatLoading(true);
    try {
      const [msgs, profile] = await Promise.all([
        fetchListingConversation(listing.id, peerId),
        fetchProfile(peerId).catch(() => null),
      ]);
      setChatMessages(msgs);
      if (profile?.display_name?.trim()) setChatPeerName(profile.display_name.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Αποτυχία φόρτωσης ιστορικού.';
      notify(msg);
    } finally {
      setChatLoading(false);
    }
  };

  /** Πάντα ανοίγει chat με τον πωλητή της αγγελίας (όχι λίστα χωρίς composer). */
  const openMessagesForListing = async () => {
    if (!selectedListing) return;
    if (!user) {
      notify('Συνδέσου για να στείλεις μήνυμα στον πωλητή.');
      router.push('/(tabs)/profile');
      return;
    }

    const sellerId = String(selectedListing.user_id ?? '');
    if (!sellerId) {
      notify('Η αγγελία δεν έχει πωλητή.');
      return;
    }

    // Δική σου αγγελία → δείξε συνομιλίες αγοραστών (αν υπάρχουν)
    if (sellerId === String(user.id)) {
      setPeersVisible(true);
      setChatLoading(true);
      try {
        const peers = await fetchListingPeers(selectedListing.id);
        setChatPeers(peers);
        if (peers.length === 1) {
          setPeersVisible(false);
          await openChatWithPeer(selectedListing, peers[0].otherUserId);
          return;
        }
        if (peers.length > 0) {
          const { fetchProfiles } = await import('@/services/supabase/profile');
          const profiles = await fetchProfiles(peers.map((p) => p.otherUserId));
          setSellerProfiles((prev) => {
            const next = new Map(prev);
            for (const [id, profile] of profiles) next.set(id, profile);
            return next;
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Αποτυχία φόρτωσης μηνυμάτων.';
        notify(msg);
        setPeersVisible(false);
      } finally {
        setChatLoading(false);
      }
      return;
    }

    // Αγοραστής → άμεσο chat με πεδίο κειμένου προς τον πωλητή
    await openChatWithPeer(
      selectedListing,
      sellerId,
      selectedSellerProfile?.display_name?.trim() || 'Πωλητής',
    );
  };

  const handleSendChat = async () => {
    if (!user || !selectedListing || !chatPeerId) return;
    if (!chatText.trim()) {
      notify('Γράψε το μήνυμά σου.');
      return;
    }
    setChatSending(true);
    try {
      const sent = await sendListingMessage({
        listingId: selectedListing.id,
        recipientId: chatPeerId,
        body: chatText.trim(),
      });
      setChatMessages((prev) => [...prev, sent]);
      setChatText('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Αποτυχία αποστολής μηνύματος.';
      notify(msg);
    } finally {
      setChatSending(false);
    }
  };

  const handleReport = async () => {
    if (!selectedListing) return;
    if (!user) {
      notify('Συνδέσου για αναφορά.');
      return;
    }
    const ask = 'Να γίνει αναφορά αυτής της αγγελίας;';
    if (Platform.OS === 'web') {
      if (!window.confirm(ask)) return;
    } else {
      Alert.alert('Αναφορά αγγελίας', ask, [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Αναφορά',
          style: 'destructive',
          onPress: async () => {
            try {
              await createListingReport({
                listingId: selectedListing.id,
                reason: 'user_report',
                details: 'Αναφορά από κουμπί detail.',
              });
              notify('Η αναφορά καταχωρήθηκε.');
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Αποτυχία αναφοράς.';
              notify(msg);
            }
          },
        },
      ]);
      return;
    }
    try {
      await createListingReport({
        listingId: selectedListing.id,
        reason: 'user_report',
        details: 'Αναφορά από κουμπί detail.',
      });
      notify('Η αναφορά καταχωρήθηκε.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Αποτυχία αναφοράς.';
      notify(msg);
    }
  };

  const handleShare = () => {
    if (!selectedListing) return;
    const price = selectedListing.price != null ? `€${Number(selectedListing.price).toFixed(2)}` : 'Χωρίς τιμή';
    const payload: SharePayload = {
      title: selectedListing.title,
      text: `${selectedListing.title}\n${price} · ${selectedListing.condition}`,
      url: buildShareUrl('/listings', { listingId: selectedListing.id }),
    };
    setSharePayload(payload);
    if (Platform.OS === 'web') {
      setShareVisible(true);
      return;
    }
    void shareWithSystem(payload).then((result) => {
      if (result === 'unavailable') setShareVisible(true);
    });
  };

  const handleToggleListingFavorite = async () => {
    if (!selectedListing) return;
    try {
      const { isFavorite } = await toggleListingFavorite({
        id: selectedListing.id,
        title: selectedListing.title,
        coverUrl: selectedListing.cover_url,
        price: selectedListing.price,
        condition: selectedListing.condition,
      });
      setListingFavorite(isFavorite);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(selectedListing.id);
        else next.delete(selectedListing.id);
        return next;
      });
      notify(isFavorite ? 'Προστέθηκε στα αγαπημένα.' : 'Αφαιρέθηκε από τα αγαπημένα.');
    } catch {
      notify('Αποτυχία ενημέρωσης αγαπημένων.');
    }
  };

  const handleToggleCardFavorite = async (item: Listing) => {
    try {
      const { isFavorite } = await toggleListingFavorite({
        id: item.id,
        title: item.title,
        coverUrl: item.cover_url,
        price: item.price,
        condition: item.condition,
      });
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      if (selectedListing?.id === item.id) setListingFavorite(isFavorite);
      notify(isFavorite ? 'Προστέθηκε στα αγαπημένα.' : 'Αφαιρέθηκε από τα αγαπημένα.');
    } catch {
      notify('Αποτυχία ενημέρωσης αγαπημένων.');
    }
  };

  const openInbox = async () => {
    if (!user) {
      notify('Συνδέσου για εισερχόμενα.');
      return;
    }
    setInboxVisible(true);
    setInboxLoading(true);
    try {
      const inboxData = await fetchSellerInbox(25);
      const conversations = groupMessagesIntoConversations(inboxData.messages, user.id);
      setSellerMessages(conversations);
      setSellerReports(inboxData.reports);
      if (conversations.length > 0) {
        const profiles = await fetchProfiles(conversations.map((c) => c.otherUserId));
        setSellerProfiles((prev) => {
          const next = new Map(prev);
          for (const [id, profile] of profiles) next.set(id, profile);
          return next;
        });
      }
      await markInboxSeen();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Αποτυχία φόρτωσης εισερχομένων.';
      notify(msg);
      setInboxVisible(false);
    } finally {
      setInboxLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (inbox !== '1' && inbox !== 'true') return;
      if (!user) return;
      let cancelled = false;
      (async () => {
        setInboxVisible(true);
        setInboxLoading(true);
        try {
          const inboxData = await fetchSellerInbox(25);
          if (cancelled) return;
          const conversations = groupMessagesIntoConversations(inboxData.messages, user.id);
          setSellerMessages(conversations);
          setSellerReports(inboxData.reports);
          if (conversations.length > 0) {
            const profiles = await fetchProfiles(conversations.map((c) => c.otherUserId));
            if (cancelled) return;
            setSellerProfiles((prev) => {
              const next = new Map(prev);
              for (const [id, profile] of profiles) next.set(id, profile);
              return next;
            });
          }
          if (!cancelled) await markInboxSeen();
        } catch {
          if (!cancelled) setInboxVisible(false);
        } finally {
          if (!cancelled) {
            setInboxLoading(false);
            router.replace(showMineOnly ? { pathname: '/(tabs)/listings', params: { mine: '1' } } : '/(tabs)/listings');
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [inbox, user, router, showMineOnly, markInboxSeen]),
  );

  const openSavedSearches = useCallback(async () => {
    setSavedVisible(true);
    setSavedLoading(true);
    try {
      const items = await fetchSavedListingSearches();
      setSavedSearches(items);
    } catch {
      setSavedSearches([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (saved !== '1' && saved !== 'true') return;
      let cancelled = false;
      (async () => {
        await openSavedSearches();
        if (!cancelled) {
          router.replace(showMineOnly ? { pathname: '/(tabs)/listings', params: { mine: '1' } } : '/(tabs)/listings');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [saved, router, showMineOnly, openSavedSearches]),
  );

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = listings.filter((item) =>
      filters.showActive ? item.is_active !== false : item.is_active === false,
    );

    if (query) {
      result = result.filter((item) => {
        const area = formatProfileArea(sellerProfiles.get(item.user_id)) ?? '';
        return (
          item.title.toLowerCase().includes(query) ||
          (item.description ?? '').toLowerCase().includes(query) ||
          item.condition.toLowerCase().includes(query) ||
          (item.price != null && String(item.price).includes(query)) ||
          area.toLowerCase().includes(query)
        );
      });
    }

    if (filters.conditions.size > 0) {
      result = result.filter((item) => filters.conditions.has(item.condition));
    }

    if (filters.priceMode === 'priced') {
      result = result.filter((item) => item.price != null);
    } else if (filters.priceMode === 'unpriced') {
      result = result.filter((item) => item.price == null);
    }

    const sorted = [...result];
    switch (filters.sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
        break;
      case 'price_desc':
        sorted.sort((a, b) => (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY));
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'el'));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
    }

    return sorted;
  }, [listings, search, sellerProfiles, filters]);

  const activeFilterCount =
    (filters.showActive ? 0 : 1) +
    filters.conditions.size +
    (filters.priceMode !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'newest' ? 1 : 0);

  const rows: Listing[][] = [];
  for (let i = 0; i < filteredListings.length; i += cols) {
    rows.push(filteredListings.slice(i, i + cols));
  }

  return (
    <CosmicBackground variant="void">
      <SafeAreaView style={styles.safe} edges={['top']}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.kirbyMagenta} />
            <Text style={styles.loadingText}>Φόρτωση…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.kirbyRed} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>ΕΠΑΝΑΦΟΡΤΩΣΗ</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle}>{showMineOnly ? 'ΟΙ ΑΓΓΕΛΙΕΣ ΜΟΥ' : 'ΑΓΓΕΛΙΕΣ'}</Text>
                  <Text style={styles.headerSub}>
                    {showMineOnly ? 'Οι δημοσιεύσεις σου' : 'Marketplace χρηστών'}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  {user ? (
                    <Pressable style={styles.inboxBtn} onPress={openInbox}>
                      <Ionicons name="mail" size={18} color={theme.text} />
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.newBtn} onPress={openCreateListing}>
                    <Ionicons name="add" size={22} color={theme.surface} />
                  </Pressable>
                </View>
              </View>
            </View>

            {!user ? (
              <Pressable style={styles.loginBanner} onPress={() => router.push('/(tabs)/profile')}>
                <Text style={styles.loginBannerText}>Συνδέσου για αγγελίες, αγορές και βαθμολογήσεις</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.surface} />
              </Pressable>
            ) : !isProfileComplete(ownProfile) ? (
              <Pressable style={styles.profileBanner} onPress={() => router.push('/(tabs)/profile')}>
                <Text style={styles.profileBannerText}>Συμπλήρωσε το προφίλ σου (όνομα + περιοχή) για να δημοσιεύεις</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.text} />
              </Pressable>
            ) : null}

            <View style={styles.searchBar}>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={theme.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Αναζήτηση αγγελιών…"
                  placeholderTextColor={theme.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {search.length > 0 ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                style={[styles.filterBtn, searchSaved && styles.saveSearchBtnActive]}
                onPress={handleSaveSearch}
                onLongPress={openSavedSearches}
                hitSlop={6}
                accessibilityLabel="Αποθήκευση αναζήτησης">
                <Ionicons
                  name={searchSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={searchSaved ? theme.kirbyMagenta : theme.text}
                />
              </Pressable>
              <Pressable style={styles.filterBtn} onPress={() => setShowFilters(true)} hitSlop={6}>
                <Ionicons name="options" size={20} color={theme.text} />
                {activeFilterCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>

            {listings.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="pricetag-outline" size={52} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>{showMineOnly ? 'Δεν έχεις αγγελίες ακόμα' : 'Καμία αγγελία ακόμα'}</Text>
                <Text style={styles.emptyText}>
                  {showMineOnly ? 'Δημοσίευσε την πρώτη σου αγγελία.' : 'Γίνε ο πρώτος που θα δημοσιεύσει!'}
                </Text>
                {!user ? (
                  <Text style={styles.emptyHint}>Συνδέσου από το Προφίλ για να δημοσιεύσεις αγγελία.</Text>
                ) : null}
              </View>
            ) : filteredListings.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="search-outline" size={44} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>Κανένα αποτέλεσμα</Text>
                <Text style={styles.emptyText}>Δοκίμασε διαφορετικό όρο αναζήτησης.</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                <Text style={styles.count}>
                  {filteredListings.length}
                  {filteredListings.length !== listings.length ? `/${listings.length}` : ''}{' '}
                  {filteredListings.length === 1 ? 'αγγελία' : 'αγγελίες'}
                </Text>
                {rows.map((row, ri) => (
                  <View key={ri} style={styles.row}>
                    {row.map((item) => (
                      <ListingCard
                        key={item.id}
                        item={item}
                        sellerArea={formatProfileArea(sellerProfiles.get(item.user_id))}
                        cardW={cardW}
                        coverH={coverH}
                        isFavorite={favoriteIds.has(item.id)}
                        isOwn={Boolean(user && item.user_id === user.id)}
                        onPress={() => setSelectedListing(item)}
                        onToggleFavorite={() => handleToggleCardFavorite(item)}
                        onEdit={() => openEditListing(item)}
                        onDelete={() => confirmDeleteListing(item)}
                      />
                    ))}
                    {row.length < cols
                      ? Array.from({ length: cols - row.length }).map((_, i) => (
                          <View key={`empty-${i}`} style={{ width: cardW }} />
                        ))
                      : null}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* New listing modal */}
        <ListingFilterPanel
          visible={showFilters}
          filters={filters}
          panelWidth={filterPanelW}
          onClose={() => setShowFilters(false)}
          onApply={setFilters}
        />
        <ShellModal visible={modalVisible} animationType="slide"  onRequestClose={() => { setModalVisible(false); resetForm(); }}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingListingId ? 'ΕΠΕΞΕΡΓΑΣΙΑ ΑΓΓΕΛΙΑΣ' : 'ΝΕΑ ΑΓΓΕΛΙΑ'}
                </Text>
                <Pressable onPress={() => { setModalVisible(false); resetForm(); }} hitSlop={12}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                {/* Image picker */}
                <Text style={styles.label}>Φωτογραφία</Text>
                <Pressable style={styles.imagePicker} onPress={pickImage}>
                  {localImageUri || existingCoverUrl ? (
                    <>
                      <Image
                        source={{ uri: localImageUri || existingCoverUrl || undefined }}
                        style={styles.imagePickerPreview}
                        resizeMode="cover"
                      />
                      <View style={styles.imagePickerOverlay}>
                        <Ionicons name="camera" size={22} color="#fff" />
                        <Text style={styles.imagePickerOverlayText}>Αλλαγή</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={36} color={theme.textMuted} />
                      <Text style={styles.imagePickerText}>Πρόσθεσε φωτογραφία</Text>
                    </>
                  )}
                </Pressable>

                <Text style={styles.label}>Τίτλος *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="π.χ. Amazing Spider-Man #1"
                  placeholderTextColor={theme.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={styles.label}>Περιγραφή</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  placeholder="Κατάσταση, ιστορικό, λεπτομέρειες…"
                  placeholderTextColor={theme.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>Τιμή (€)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="π.χ. 15.00"
                  placeholderTextColor={theme.textMuted}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Κατάσταση</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.condRow}>
                    {CONDITIONS.map((c) => (
                      <Pressable
                        key={c}
                        style={[styles.condChip, condition === c && styles.condChipActive]}
                        onPress={() => setCondition(c)}>
                        <Text style={[styles.condChipText, condition === c && styles.condChipTextActive]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.formActiveRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Ενεργή αγγελία</Text>
                    <Text style={styles.formActiveHint}>
                      {listingActive ? 'Εμφανίζεται στις αγγελίες' : 'Κρυφή από το marketplace'}
                    </Text>
                  </View>
                  <Switch
                    value={listingActive}
                    onValueChange={setListingActive}
                    trackColor={{ false: '#C9C9C9', true: theme.kirbyMagenta }}
                    thumbColor={theme.surface}
                  />
                </View>

                {formError ? <Text style={styles.formError}>{formError}</Text> : null}

                <Pressable style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color={theme.surface} />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {editingListingId ? 'ΑΠΟΘΗΚΕΥΣΗ' : 'ΔΗΜΟΣΙΕΥΣΗ'}
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </ShellModal>

        {/* Listing detail + chat στην ίδια Modal (αποφεύγει stacking bugs) */}
        <ShellModal
          visible={!!selectedListing}
          animationType="slide"
          onRequestClose={() => {
            if (chatVisible) {
              setChatVisible(false);
              return;
            }
            setSelectedListing(null);
            if (listingId) router.replace('/(tabs)/listings');
          }}>
          <View style={styles.detailFullScreen}>
            {selectedListing && chatVisible ? (
              <SafeAreaView style={styles.chatScreen} edges={['top', 'bottom']}>
                <View style={styles.chatHeader}>
                  <Pressable onPress={() => setChatVisible(false)} hitSlop={12}>
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                  </Pressable>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.chatTitle} numberOfLines={1}>{chatPeerName}</Text>
                    <Text style={styles.chatSub} numberOfLines={1}>{selectedListing.title}</Text>
                  </View>
                  <Pressable
                    onPress={() => setChatVisible(false)}
                    hitSlop={6}
                    accessibilityLabel="Άνοιγμα αγγελίας">
                    {selectedListing.cover_url ? (
                      <Image
                        source={{ uri: selectedListing.cover_url }}
                        style={styles.chatHeaderCover}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.chatHeaderCover, styles.chatHeaderCoverEmpty]}>
                        <Ionicons name="image-outline" size={16} color={theme.textMuted} />
                      </View>
                    )}
                  </Pressable>
                </View>

                {chatLoading ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={theme.kirbyMagenta} />
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.chatBody}
                    showsVerticalScrollIndicator={false}>
                    {chatMessages.length === 0 ? (
                      <Text style={styles.helperEmpty}>
                        Γράψε το μήνυμά σου στον πωλητή παρακάτω και πάτα αποστολή.
                      </Text>
                    ) : (
                      chatMessages.map((m) => {
                        const mine = m.sender_id === user?.id;
                        return (
                          <View
                            key={m.id}
                            style={[styles.chatBubble, mine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}>
                            <Text style={[styles.chatBubbleText, mine && styles.chatBubbleTextMine]}>
                              {m.body}
                            </Text>
                            <Text style={[styles.chatTime, mine && styles.chatTimeMine]}>
                              {new Date(m.created_at).toLocaleString('el-GR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                )}

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                  <View style={styles.chatComposer}>
                    <TextInput
                      style={styles.chatInput}
                      value={chatText}
                      onChangeText={setChatText}
                      placeholder="Γράψε μήνυμα στον πωλητή…"
                      placeholderTextColor={theme.textMuted}
                      multiline
                      autoFocus
                    />
                    <Pressable style={styles.chatSendBtn} onPress={handleSendChat} disabled={chatSending}>
                      {chatSending ? (
                        <ActivityIndicator color={theme.surface} />
                      ) : (
                        <Ionicons name="send" size={18} color={theme.surface} />
                      )}
                    </Pressable>
                  </View>
                </KeyboardAvoidingView>
              </SafeAreaView>
            ) : selectedListing ? (
              <ScrollView contentContainerStyle={styles.detailSheet} showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailHeaderTitle}>Λεπτομέρειες αγγελίας</Text>
                  <Pressable
                    onPress={() => {
                      setSelectedListing(null);
                      if (listingId) router.replace('/(tabs)/listings');
                    }}
                    hitSlop={12}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </Pressable>
                </View>
                <View style={styles.heroRow}>
                  <View style={styles.heroCoverCol}>
                    {selectedListing.cover_url ? (
                      <ZoomableCover
                        uri={selectedListing.cover_url}
                        style={styles.detailImage}
                        resizeMode="cover"
                        caption={selectedListing.title}
                      />
                    ) : (
                      <View style={[styles.detailImage, styles.cardImgPlaceholder]}>
                        <Ionicons name="image-outline" size={36} color={theme.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.heroActionsCol}>
                    <Text style={styles.detailTitle}>{selectedListing.title}</Text>
                    <View style={styles.detailMetaRow}>
                      <View style={styles.condBadge}>
                        <Text style={styles.condText}>{selectedListing.condition}</Text>
                      </View>
                      {selectedListing.price != null ? (
                        <Text style={styles.cardPrice}>€{Number(selectedListing.price).toFixed(2)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.detailSubMeta}>Κατάσταση: {selectedListing.condition} · Γλώσσα: Ελληνικά</Text>
                    <Text style={styles.descLabel}>Περιγραφή:</Text>
                    <Text style={styles.detailDesc}>
                      {selectedListing.description?.trim() || '—'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDate}>
                  {new Date(selectedListing.created_at).toLocaleDateString('el-GR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </Text>

                <View style={styles.sellerBox}>
                  <Text style={styles.sellerLabel}>Πωλητής</Text>
                  <Text style={styles.sellerName}>
                    {user && selectedListing.user_id === user.id
                      ? 'Εσύ'
                      : selectedSellerProfile?.display_name?.trim() ||
                        sellerProfiles.get(selectedListing.user_id)?.display_name?.trim() ||
                        'Χωρίς όνομα προφίλ'}
                  </Text>
                  {selectedSellerStats && selectedSellerStats.review_count > 0 ? (
                    <Text style={styles.sellerMeta}>
                      ★ {selectedSellerStats.avg_score.toFixed(1)} · {selectedSellerStats.review_count} αξιολογήσεις
                    </Text>
                  ) : (
                    <Text style={styles.sellerMeta}>Χωρίς αξιολογήσεις ακόμα</Text>
                  )}
                  {formatProfileArea(
                    selectedSellerProfile ?? sellerProfiles.get(selectedListing.user_id) ?? null,
                  ) ? (
                    <Text style={styles.sellerMeta}>
                      📍{' '}
                      {formatProfileArea(
                        selectedSellerProfile ?? sellerProfiles.get(selectedListing.user_id) ?? null,
                      )}
                    </Text>
                  ) : (
                    <Text style={styles.sellerMeta}>Περιοχή δεν έχει οριστεί</Text>
                  )}
                </View>

                <View style={styles.detailActionsRow}>
                  {user && selectedListing.user_id === user.id ? (
                    <>
                      <Pressable
                        style={[styles.detailActionBtn, styles.detailActionPrimary]}
                        onPress={() => openEditListing(selectedListing)}>
                        <Text style={styles.detailActionPrimaryText}>Επεξεργασία</Text>
                      </Pressable>
                      <Pressable
                        style={styles.detailActionBtn}
                        onPress={() => confirmDeleteListing(selectedListing)}>
                        <Text style={[styles.detailActionText, { color: theme.kirbyRed }]}>Διαγραφή</Text>
                      </Pressable>
                      <Pressable style={styles.detailActionBtn} onPress={handleShare}>
                        <Text style={styles.detailActionText}>Κοινοποίηση</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable style={[styles.detailActionBtn, styles.detailActionPrimary]} onPress={openMessagesForListing}>
                        <Text style={styles.detailActionPrimaryText}>Μήνυμα</Text>
                      </Pressable>
                      <Pressable style={styles.detailActionBtn} onPress={handleShare}>
                        <Text style={styles.detailActionText}>Κοινοποίηση</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.detailActionBtn, listingFavorite && styles.detailActionFavActive]}
                        onPress={handleToggleListingFavorite}>
                        <Text style={[styles.detailActionText, listingFavorite && styles.detailActionFavText]}>
                          {listingFavorite ? 'Αγαπημένο' : 'Αγαπημένα'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
                {!(user && selectedListing.user_id === user.id) ? (
                  <Pressable onPress={handleReport}>
                    <Text style={styles.reportText}>Αναφορά αγγελίας</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            ) : null}
            <ShareSheet
              visible={shareVisible}
              payload={sharePayload}
              onClose={() => setShareVisible(false)}
              onNotice={notify}
            />
          </View>
        </ShellModal>

        <ShellModal
          visible={peersVisible}
          
          animationType="slide"
          onRequestClose={() => setPeersVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.smallSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Συνομιλίες αγγελίας</Text>
                <Pressable onPress={() => setPeersVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>
              {chatLoading ? (
                <ActivityIndicator color={theme.kirbyMagenta} style={{ marginVertical: 20 }} />
              ) : chatPeers.length === 0 ? (
                <View style={{ gap: 10, paddingVertical: 8 }}>
                  <Text style={styles.helperEmpty}>
                    Αυτή είναι η αγγελία σου — δεν μπορείς να στείλεις μήνυμα στον εαυτό σου.
                  </Text>
                  <Text style={styles.helperEmpty}>
                    Για να μιλήσεις με πωλητή: άνοιξε αγγελία άλλου χρήστη (ή συνδέσου με δεύτερο λογαριασμό).
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 360 }}>
                  {chatPeers.map((peer) => (
                    <Pressable
                      key={peer.otherUserId}
                      style={styles.inboxItem}
                      onPress={() => selectedListing && openChatWithPeer(selectedListing, peer.otherUserId)}>
                      <Text style={styles.inboxItemTitle}>
                        {sellerProfiles.get(peer.otherUserId)?.display_name?.trim() ||
                          `Χρήστης ${peer.otherUserId.slice(0, 8)}`}
                      </Text>
                      <Text style={styles.inboxItemMeta} numberOfLines={2}>{peer.lastBody}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </ShellModal>

        {actionMsg ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{actionMsg}</Text>
          </View>
        ) : null}

        <ShellModal visible={savedVisible} animationType="slide"  onRequestClose={() => setSavedVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.inboxSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>ΑΠΟΘΗΚΕΥΜΕΝΕΣ ΑΝΑΖΗΤΗΣΕΙΣ</Text>
                <Pressable onPress={() => setSavedVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>
              {savedLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.kirbyMagenta} />
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.inboxBody}>
                  {savedSearches.length === 0 ? (
                    <Text style={styles.inboxItemMeta}>Δεν έχεις αποθηκεύσει αναζητήσεις ακόμα.</Text>
                  ) : (
                    savedSearches.map((item) => (
                      <View key={item.id} style={styles.savedSearchRow}>
                        <Pressable style={styles.savedSearchMain} onPress={() => applySavedSearch(item)}>
                          <Ionicons name="search" size={16} color={theme.text} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.inboxItemTitle}>{item.query}</Text>
                            <Text style={styles.inboxItemMeta}>
                              {item.mineOnly ? 'Οι αγγελίες μου' : 'Όλες οι αγγελίες'}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => handleRemoveSavedSearch(item.id)} hitSlop={8} style={styles.savedSearchDelete}>
                          <Ionicons name="trash-outline" size={18} color={theme.kirbyRed} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </ShellModal>

        <ShellModal visible={inboxVisible} animationType="slide"  onRequestClose={() => setInboxVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.inboxSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Μηνύματα</Text>
                <Pressable onPress={() => setInboxVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>
              {inboxLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.kirbyMagenta} />
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.inboxBody}>
                  <Text style={styles.inboxSectionTitle}>Συνομιλίες ({sellerMessages.length})</Text>
                  {sellerMessages.length === 0 ? (
                    <Text style={styles.inboxItemMeta}>Δεν υπάρχουν μηνύματα ακόμα.</Text>
                  ) : null}
                  {sellerMessages.slice(0, 20).map((c) => {
                    const peerName =
                      sellerProfiles.get(c.otherUserId)?.display_name?.trim() ||
                      `Χρήστης ${c.otherUserId.slice(0, 8)}`;
                    const when = new Date(c.lastAt).toLocaleString('el-GR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const coverUrl =
                      c.listingCoverUrl ||
                      listings.find((l) => l.id === c.listingId)?.cover_url ||
                      null;
                    return (
                      <View key={c.key} style={styles.inboxItem}>
                        <Pressable
                          style={styles.inboxItemBody}
                          onPress={() => {
                          const listing =
                            listings.find((l) => l.id === c.listingId) ??
                            ({
                              id: c.listingId,
                              user_id: user?.id ?? '',
                              title: c.listingTitle ?? 'Αγγελία',
                              description: null,
                              price: null,
                              cover_url: coverUrl,
                              condition: 'VF',
                              is_active: true,
                              created_at: c.lastAt,
                            } as Listing);
                          setInboxVisible(false);
                          openChatWithPeer(listing, c.otherUserId, peerName);
                        }}>
                          <Text style={styles.inboxItemTitle} numberOfLines={1}>
                            {peerName}
                            {c.messageCount > 1 ? ` · ${c.messageCount} μηνύματα` : ''}
                          </Text>
                          <Text style={styles.inboxItemMeta} numberOfLines={1}>
                            {c.listingTitle ?? 'Αγγελία'}
                          </Text>
                          <Text style={styles.inboxItemMeta} numberOfLines={2}>
                            {c.lastBody}
                          </Text>
                          <Text style={styles.inboxItemMeta}>{when}</Text>
                        </Pressable>
                        {coverUrl ? (
                          <ZoomableCover
                            uri={coverUrl}
                            style={styles.inboxItemCover}
                            resizeMode="cover"
                            caption={c.listingTitle ?? 'Αγγελία'}
                          />
                        ) : (
                          <View style={[styles.inboxItemCover, styles.inboxItemCoverEmpty]}>
                            <Ionicons name="image-outline" size={18} color={theme.textMuted} />
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {sellerReports.length > 0 ? (
                    <>
                      <Text style={styles.inboxSectionTitle}>Αναφορές ({sellerReports.length})</Text>
                      {sellerReports.slice(0, 5).map((r) => (
                        <View key={r.id} style={styles.inboxItem}>
                          <Text style={styles.inboxItemTitle}>{r.listing?.title ?? 'Αγγελία'}</Text>
                          <Text style={styles.inboxItemMeta}>{r.reason} · {r.status}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </ScrollView>
              )}
            </View>
          </View>
        </ShellModal>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, position: 'relative' },

  // Header
  header: {
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.kirbyYellow,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inboxBtn: {
    width: 38,
    height: 38,
    backgroundColor: theme.kirbyYellow,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtn: {
    width: 40, height: 40,
    backgroundColor: theme.kirbyMagenta, borderWidth: 2, borderColor: theme.border,
    justifyContent: 'center', alignItems: 'center',
  },
  loginBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.kirbyMagenta,
    borderWidth: 2,
    borderColor: theme.border,
  },
  loginBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: theme.surface,
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.kirbyYellow,
    borderWidth: 2,
    borderColor: theme.border,
  },
  profileBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: theme.text,
  },

  // States
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  errorText: { fontSize: 13, fontWeight: '700', color: theme.kirbyYellow, textAlign: 'center' },
  retryBtn: { borderWidth: 2, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.surface },
  retryText: { fontSize: 12, fontWeight: '900', color: theme.text },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: theme.kirbyYellow },
  emptyText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  emptyHint: { fontSize: 11, fontWeight: '600', color: theme.kirbyYellow, textAlign: 'center', marginTop: 4 },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 48,
    paddingHorizontal: 24,
  },

  // List
  list: {
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
    width: '100%',
  },
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  count: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    padding: 0,
  },
  filterBtn: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 8,
    position: 'relative',
  },
  saveSearchBtnActive: {
    borderColor: theme.kirbyMagenta,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.kirbyMagenta,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.surface,
  },
  filterModalRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 0,
  },
  filterPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.surface,
    borderLeftWidth: 2,
    borderLeftColor: theme.border,
    paddingBottom: 20,
    zIndex: 2,
    elevation: 12,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
    marginBottom: 4,
  },
  statusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
    backgroundColor: '#fff8e0',
  },
  statusToggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusToggleTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 0.3,
  },
  statusToggleHint: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
  },
  formActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  formActiveHint: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    marginTop: -4,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  sectionHeaderOpen: {
    backgroundColor: '#fff8e0',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 0.5,
  },
  sectionBadge: {
    backgroundColor: theme.kirbyMagenta,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '900', color: theme.surface },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  radioActive: { borderColor: theme.kirbyMagenta },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.kirbyMagenta,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterLabel: { fontSize: 13, fontWeight: '700', color: theme.text },
  filterLabelActive: { fontWeight: '900', color: theme.kirbyMagenta },
  filterFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterReset: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  filterResetText: { fontSize: 12, fontWeight: '900', color: theme.text },
  filterApply: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: theme.kirbyMagenta,
    borderWidth: 2,
    borderColor: theme.border,
  },
  filterApplyText: { fontSize: 12, fontWeight: '900', color: theme.surface },
  savedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedSearchMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  savedSearchDelete: {
    padding: 6,
  },

  // Card
  card: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  cardHeart: {
    position: 'absolute',
    right: 6,
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: theme.cosmicInk,
    backgroundColor: 'rgba(255,253,245,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardOwnerActions: {
    position: 'absolute',
    right: 6,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  cardActionBtn: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: theme.cosmicInk,
    backgroundColor: 'rgba(255,253,245,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    backgroundColor: theme.kirbyBlue,
    padding: 6,
    justifyContent: 'space-between',
  },
  coverPlaceholderText: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.surface,
    lineHeight: 11,
  },
  cardImgPlaceholder: { backgroundColor: theme.kirbyBlue + '33', justifyContent: 'center', alignItems: 'center' },
  cardBody: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 8, gap: 4 },
  cardTitle: { fontSize: 11, fontWeight: '900', color: theme.text, lineHeight: 14 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  condBadge: {
    borderWidth: 1.5, borderColor: theme.border,
    backgroundColor: theme.kirbyYellow,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  condText: { fontSize: 9, fontWeight: '900', color: theme.text },
  gridPrice: { fontSize: 11, fontWeight: '900', color: theme.kirbyMagenta },
  cardPrice: { fontSize: 16, fontWeight: '900', color: theme.kirbyMagenta },
  cardArea: { fontSize: 9, fontWeight: '700', color: theme.kirbyBlue },
  cardDate: { fontSize: 10, fontWeight: '700', color: theme.textMuted, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 2, borderColor: theme.border,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 2, borderBottomColor: theme.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
  modalBody: { padding: 16, gap: 4, paddingBottom: 32 },
  label: { fontSize: 11, fontWeight: '900', color: theme.kirbyMagenta, letterSpacing: 0.5, marginTop: 10 },
  imagePicker: {
    width: 120, height: 160,
    borderWidth: 2, borderColor: theme.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.kirbyBlue + '15',
    overflow: 'hidden',
  },
  imagePickerPreview: { width: '100%', height: '100%' },
  imagePickerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6,
    alignItems: 'center', gap: 2,
  },
  imagePickerOverlayText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  imagePickerText: { fontSize: 11, fontWeight: '700', color: theme.textMuted, marginTop: 6, textAlign: 'center' },
  input: {
    borderWidth: 2, borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontWeight: '600', color: theme.text,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  condRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  condChip: {
    borderWidth: 2, borderColor: theme.border,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  condChipActive: { backgroundColor: theme.kirbyMagenta, borderColor: theme.kirbyMagenta },
  condChipText: { fontSize: 12, fontWeight: '900', color: theme.text },
  condChipTextActive: { color: theme.surface },
  formError: { fontSize: 12, fontWeight: '700', color: theme.kirbyRed, marginTop: 8 },
  submitBtn: {
    marginTop: 16,
    backgroundColor: theme.kirbyMagenta, borderWidth: 2, borderColor: theme.border,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '900', color: theme.surface, letterSpacing: 0.5 },
  smallSheet: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 14,
    gap: 8,
    maxHeight: 360,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  sheetBtnGhost: {
    borderWidth: 2,
    borderColor: theme.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sheetBtnGhostText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.text,
  },
  sheetBtnPrimary: {
    backgroundColor: theme.kirbyMagenta,
    borderWidth: 2,
    borderColor: theme.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sheetBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.surface,
  },
  detailFullScreen: {
    flex: 1,
    backgroundColor: theme.surface,
    position: 'relative',
  },
  detailSheet: {
    padding: 14,
    gap: 8,
    paddingBottom: 28,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCoverCol: {
    width: '100%',
    maxWidth: 220,
    alignSelf: 'center',
  },
  heroActionsCol: {
    flex: 1,
    minWidth: 160,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
    paddingBottom: 8,
    marginBottom: 2,
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.text,
    flex: 1,
    paddingRight: 8,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderWidth: 2,
    borderColor: theme.border,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.text,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    lineHeight: 18,
  },
  descLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
    color: theme.text,
  },
  detailSubMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
  },
  sellerBox: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
    gap: 2,
  },
  sellerLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.textMuted,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.text,
  },
  sellerMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  detailActionBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#f9a332',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: theme.surface,
  },
  detailActionPrimary: {
    backgroundColor: theme.surface,
  },
  detailActionPrimaryText: {
    color: '#f9a332',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  detailActionText: {
    color: '#f9a332',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  detailActionFavActive: {
    borderColor: theme.kirbyRed,
    backgroundColor: '#fff5f5',
  },
  detailActionFavText: {
    color: theme.kirbyRed,
  },
  helperEmpty: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  chatScreen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  chatHeaderCover: {
    width: 40,
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.kirbyBlue + '33',
  },
  chatHeaderCoverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.text,
  },
  chatSub: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  chatBody: {
    padding: 14,
    gap: 8,
    flexGrow: 1,
  },
  chatBubble: {
    maxWidth: '78%',
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: theme.kirbyMagenta,
    borderColor: theme.kirbyMagenta,
  },
  chatBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: theme.surface,
  },
  chatBubbleText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  chatBubbleTextMine: {
    color: theme.surface,
  },
  chatTime: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
  },
  chatTimeMine: {
    color: 'rgba(255,255,255,0.85)',
  },
  chatComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 2,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
  },
  chatInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    backgroundColor: theme.kirbyMagenta,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
    textDecorationLine: 'underline',
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: 'rgba(0,0,0,0.84)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  inboxSheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2,
    borderColor: theme.border,
    maxHeight: '82%',
  },
  inboxBody: {
    padding: 12,
    gap: 8,
    paddingBottom: 28,
  },
  inboxSectionTitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '900',
    color: theme.kirbyMagenta,
  },
  inboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    gap: 10,
  },
  inboxItemBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  inboxItemCover: {
    width: 52,
    height: 72,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.kirbyBlue + '33',
  },
  inboxItemCoverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  inboxItemMeta: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
  },
});
