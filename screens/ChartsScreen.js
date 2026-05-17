import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCharts } from '../hooks/useCharts';
import { SkeletonList } from '../components/Skeleton';

const TABS = [
  { key: 'song', label: 'Songs' },
  { key: 'album', label: 'Albums' },
  { key: 'artist', label: 'Artists' },
];

export default function ChartsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('song');
  const { data: items = [], isLoading } = useCharts({ entityType: activeTab, limit: 50 });

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => {
        if (activeTab === 'song') {
          navigation.navigate('SongDetailsScreen', { songId: item.entityId });
        } else if (activeTab === 'album') {
          navigation.navigate('AlbumDetailsScreen', { albumId: item.entityId });
        } else if (activeTab === 'artist') {
          navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
        }
      }}
    >
      <Text style={styles.rank}>#{index + 1}</Text>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.thumbnail} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.thumbnail, { backgroundColor: '#2A2A2A' }]} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name || item.entityId}</Text>
        {item.artist ? (
          <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
        ) : null}
      </View>
      <View style={styles.ratingBlock}>
        <Text style={styles.ratingValue}>{item.averageRating?.toFixed(1)}</Text>
        <Text style={styles.ratingStar}>★</Text>
        <Text style={styles.ratingCount}>({item.ratingCount})</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Top Rated</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <SkeletonList count={8} itemStyle={styles.skeletonItem} />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.entityId}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No ratings yet.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
  },
  activeTab: {
    backgroundColor: '#A071CA',
  },
  tabText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rank: {
    color: '#A071CA',
    fontSize: 16,
    fontWeight: 'bold',
    width: 36,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  artist: {
    color: '#D9D0E7',
    fontSize: 12,
    marginTop: 2,
  },
  ratingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: 'bold',
  },
  ratingStar: {
    color: '#FFD700',
    fontSize: 12,
    marginLeft: 2,
  },
  ratingCount: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
  },
  skeletonItem: {
    height: 60,
    marginBottom: 8,
  },
  emptyText: {
    color: '#B9B0C7',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});
