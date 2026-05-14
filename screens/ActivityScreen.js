import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActivity } from '../hooks/useActivity';
import { SkeletonList } from '../components/Skeleton';

const ACTIVITY_ICONS = {
  comment: '💬',
  rating: '⭐',
  favorite: '❤️',
};

export default function ActivityScreen({ navigation }) {
  const { data: activities = [], isLoading } = useActivity({ limit: 50 });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => {
        if (item.entityType === 'song' && item.entityId) {
          navigation.navigate('SongDetailsScreen', { songId: item.entityId });
        } else if (item.entityType === 'album' && item.entityId) {
          navigation.navigate('AlbumDetailsScreen', { album: { id: item.entityId } });
        } else if (item.entityType === 'artist' && item.entityId) {
          navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
        } else if (item.entityType === 'profile' && item.entityId) {
          navigation.navigate('UserDetailsScreen', { profileId: item.entityId });
        }
      }}
    >
      <Text style={styles.icon}>{ACTIVITY_ICONS[item.type] || '•'}</Text>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.username}>{item.username}</Text>
          {item.timestamp && (
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleDateString()}
            </Text>
          )}
        </View>
        <Text style={styles.text}>
          {item.type === 'comment' && `Commented: "${item.text}"`}
          {item.type === 'rating' && `Rated ${item.entityType} ${item.rating}/10`}
          {item.type === 'favorite' && `Favorited ${item.name || item.entityType}`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      {isLoading ? (
        <SkeletonList count={8} itemStyle={styles.skeletonItem} />
      ) : (
        <FlatList
          data={activities}
          renderItem={renderItem}
          keyExtractor={(_, index) => `activity-${index}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No recent activity.</Text>
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
    marginBottom: 10,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    color: '#A071CA',
    fontWeight: 'bold',
    fontSize: 14,
  },
  timestamp: {
    color: '#888',
    fontSize: 11,
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  skeletonItem: {
    height: 60,
    marginBottom: 10,
  },
  emptyText: {
    color: '#B9B0C7',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});
