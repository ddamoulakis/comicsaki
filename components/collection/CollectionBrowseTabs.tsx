import { Pressable, StyleSheet, Text, View } from 'react-native';

import { collectionBrowseTabs, type CollectionBrowseTab } from '@/types/collection';
import { theme } from '@/constants/Theme';

type CollectionBrowseTabsProps = {
  activeTab: CollectionBrowseTab;
  onChange: (tab: CollectionBrowseTab) => void;
};

export function CollectionBrowseTabs({ activeTab, onChange }: CollectionBrowseTabsProps) {
  return (
    <View style={styles.row}>
      {collectionBrowseTabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, active && styles.tabActive]}>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.kirbyBlue,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: theme.surface,
  },
});
