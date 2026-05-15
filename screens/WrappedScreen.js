import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMonthlyWrapped } from '../hooks/useMonthlyWrapped';
import { DetailSkeleton } from '../components/Skeleton';

const TYPE_LABELS = {
  song: 'Songs',
  album: 'Albums',
  artist: 'Artists',
};

const getMonthLabel = (month) => {
  if (!month) return 'This month';
  const [year, monthIndex] = month.split('-').map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getTypeLabel = (type) => TYPE_LABELS[type] || 'Music';

export default function WrappedScreen({ navigation }) {
  const { data, isLoading, isError } = useMonthlyWrapped();
  const summary = data?.summary || {};
  const ratingsByType = data?.ratingsByType || {};
  const favoritesByType = data?.favoritesByType || {};
  const hasActivity = summary.ratingsCount > 0 || summary.favoritesCount > 0;

  const handleOpenItem = (item) => {
    if (item.entityType === 'song') {
      navigation.navigate('SongDetailsScreen', { songId: item.entityId });
    } else if (item.entityType === 'album') {
      navigation.navigate('AlbumDetailsScreen', { album: { id: item.entityId } });
    } else if (item.entityType === 'artist') {
      navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-left" size={18} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.kicker}>SongBox Monthly</Text>
          <Text style={styles.title}>Your Month in Music</Text>
          <Text style={styles.month}>{getMonthLabel(data?.month)}</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroCopy}>
            A compact snapshot of what you rated, saved, and kept coming back to.
          </Text>
        </View>

        {isError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Could not load your Wrapped</Text>
            <Text style={styles.emptyText}>Try again in a moment.</Text>
          </View>
        ) : null}

        {!isError && !hasActivity ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your month is still warming up</Text>
            <Text style={styles.emptyText}>Rate songs, albums, or artists to build your first Wrapped.</Text>
          </View>
        ) : null}

        {!isError && hasActivity ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Ratings" value={summary.ratingsCount || 0} accent="#FFD166" />
              <StatCard label="Avg score" value={(summary.averageRating || 0).toFixed(1)} accent="#BBA7FF" />
              <StatCard label="Favorites" value={summary.favoritesCount || 0} accent="#7AE7C7" />
              <StatCard label="New saves" value={summary.newFavoritesCount || 0} accent="#FF8FAB" />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>You rated mostly</Text>
              <Text style={styles.bigType}>{getTypeLabel(summary.topEntityType)}</Text>
              <View style={styles.barList}>
                {Object.entries(ratingsByType).map(([type, count]) => (
                  <BarRow key={type} label={getTypeLabel(type)} value={count} max={summary.ratingsCount || 1} />
                ))}
              </View>
            </View>

            {data?.topArtists?.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Artists in your orbit</Text>
                {data.topArtists.map((artist, index) => (
                  <View key={artist.name} style={styles.artistRow}>
                    <Text style={styles.artistRank}>#{index + 1}</Text>
                    <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
                    <Text style={styles.artistCount}>{artist.count}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {data?.topRated?.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Highest rated</Text>
                {data.topRated.map((item) => (
                  <WrappedItem key={`${item.entityType}-${item.entityId}`} item={item} onPress={() => handleOpenItem(item)} />
                ))}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Your library mix</Text>
              <View style={styles.chips}>
                {Object.entries(favoritesByType).map(([type, count]) => (
                  <View key={type} style={styles.chip}>
                    <Text style={styles.chipValue}>{count}</Text>
                    <Text style={styles.chipLabel}>{getTypeLabel(type)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard = ({ label, value, accent }) => (
  <View style={styles.statCard}>
    <View style={[styles.statDot, { backgroundColor: accent }]} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const BarRow = ({ label, value, max }) => (
  <View style={styles.barRow}>
    <View style={styles.barHeader}>
      <Text style={styles.barLabel}>{label}</Text>
      <Text style={styles.barValue}>{value}</Text>
    </View>
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max((value / max) * 100, 8)}%` }]} />
    </View>
  </View>
);

const WrappedItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.itemRow} onPress={onPress}>
    {item.image ? (
      <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" cachePolicy="memory-disk" />
    ) : (
      <View style={styles.itemImagePlaceholder} />
    )}
    <View style={styles.itemInfo}>
      <Text style={styles.itemName} numberOfLines={1}>{item.name || item.entityId}</Text>
      <Text style={styles.itemMeta} numberOfLines={1}>{item.artist || getTypeLabel(item.entityType)}</Text>
    </View>
    <View style={styles.itemRating}>
      <Text style={styles.itemRatingValue}>{Number(item.rating || 0).toFixed(1)}</Text>
      <Text style={styles.itemStar}>★</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroCard: {
    minHeight: 250,
    borderRadius: 34,
    padding: 24,
    backgroundColor: '#251F2F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -70,
    right: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(187,167,255,0.28)',
  },
  kicker: {
    color: '#BBA7FF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 44,
    marginTop: 18,
    maxWidth: 260,
  },
  month: {
    color: '#F4E7C5',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  heroDivider: {
    width: 54,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFD166',
    marginTop: 22,
  },
  heroCopy: {
    color: '#D8D0E4',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
    maxWidth: 280,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    width: '48%',
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  statValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    color: '#AFA4BC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    marginTop: 18,
    borderRadius: 28,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  bigType: {
    color: '#FFD166',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 12,
  },
  barList: {
    gap: 12,
  },
  barRow: {
    gap: 7,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabel: {
    color: '#EDE8F5',
    fontWeight: '700',
  },
  barValue: {
    color: '#AFA4BC',
    fontWeight: '800',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BBA7FF',
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  artistRank: {
    color: '#BBA7FF',
    fontWeight: '900',
    width: 42,
  },
  artistName: {
    flex: 1,
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  artistCount: {
    color: '#AFA4BC',
    fontWeight: '800',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  itemImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  itemMeta: {
    color: '#AFA4BC',
    fontSize: 12,
    marginTop: 3,
  },
  itemRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRatingValue: {
    color: '#FFD166',
    fontWeight: '900',
  },
  itemStar: {
    color: '#FFD166',
    marginLeft: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    minWidth: 92,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(187,167,255,0.12)',
  },
  chipValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  chipLabel: {
    color: '#CFC4DF',
    fontWeight: '700',
    marginTop: 2,
  },
  emptyCard: {
    marginTop: 18,
    borderRadius: 26,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
  },
  emptyText: {
    color: '#BDB4CA',
    marginTop: 8,
    lineHeight: 20,
  },
});
