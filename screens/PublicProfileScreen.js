import React, { useContext, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { resolveImageUrl, splitFavorites } from '../utils/normalizers';

export default function PublicProfileScreen({ route, navigation }) {
  const username = route?.params?.username;
  const { axiosInstance } = useContext(AuthContext);

  const profileQuery = useQuery({
    queryKey: ['publicProfile', username],
    enabled: Boolean(axiosInstance && username),
    queryFn: async () => {
      const response = await axiosInstance.get(`/public_profile/${encodeURIComponent(username)}`);
      return response.data;
    },
  });

  const profile = profileQuery.data;
  const imageSource = useMemo(() => {
    const resolved = resolveImageUrl(profile?.profile_picture);
    return resolved ? { uri: resolved } : require('../assets/default_picture.png');
  }, [profile?.profile_picture]);
  const { albums, songs, artists } = splitFavorites(profile?.favorites || []);
  const featured = [...albums, ...songs, ...artists].slice(0, 9);
  const publicUrl = profile ? `songbox.app/@${profile.username}` : '';

  if (profileQuery.isLoading) return <DetailSkeleton />;

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.title}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="angle-left" size={28} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.heroAura} />
          <Image source={imageSource} style={styles.avatar} contentFit="cover" />
          <Text style={styles.username}>{profile.username}</Text>
          <Text style={styles.handle}>songbox.app/@{profile.username}</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => Share.share({ message: `Check out ${profile.username}'s SongBox: ${publicUrl}` })}
            activeOpacity={0.86}
          >
            <Icon name="share-alt" size={14} color="#171515" />
            <Text style={styles.shareButtonText}>Share profile</Text>
          </TouchableOpacity>
          <View style={styles.statsRow}>
            <PublicStat label="Favorites" value={profile.counts?.favorites || 0} />
            <PublicStat label="Followers" value={profile.counts?.followers || 0} />
            <PublicStat label="Following" value={profile.counts?.following || 0} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionKicker}>Taste Preview</Text>
          <Text style={styles.sectionTitle}>Featured favorites</Text>
          {featured.length > 0 ? (
            <View style={styles.grid}>
              {featured.map((item) => (
                <TouchableOpacity
                  key={`${item.entityType}-${item.entityId}`}
                  style={styles.gridItem}
                  onPress={() => {
                    if (item.entityType === 'album') navigation.navigate('AlbumDetailsScreen', { albumId: item.entityId });
                    if (item.entityType === 'song') navigation.navigate('SongDetailsScreen', { songId: item.entityId });
                    if (item.entityType === 'artist') navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
                  }}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.gridImage} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={styles.gridImage} />
                  )}
                  <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No public favorites yet.</Text>
          )}
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Made with SongBox</Text>
          <Text style={styles.footerText}>Build your music taste archive and compare with friends.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PublicStat = ({ label, value }) => (
  <View style={styles.statPill}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 34,
  },
  backButton: {
    marginTop: 8,
    marginBottom: 8,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 34,
    backgroundColor: 'rgba(32,27,39,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  heroAura: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(187,167,255,0.2)',
  },
  avatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    borderColor: 'rgba(244,231,197,0.6)',
  },
  username: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 16,
  },
  handle: {
    color: '#BBA7FF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  shareButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F4E7C5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButtonText: {
    color: '#171515',
    fontSize: 13,
    fontWeight: '900',
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  statValue: {
    color: '#FFD166',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: '#D8D0E4',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(32,27,39,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionKicker: {
    color: '#F4E7C5',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '30.5%',
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#2A2532',
  },
  gridName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
  },
  footerCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#F4E7C5',
  },
  footerTitle: {
    color: '#171515',
    fontSize: 18,
    fontWeight: '900',
  },
  footerText: {
    color: '#5F4F31',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyCard: {
    margin: 18,
    padding: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  emptyText: {
    color: '#D8D0E4',
    fontSize: 14,
    lineHeight: 20,
  },
});
