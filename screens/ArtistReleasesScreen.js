import React, { useContext, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage } from '../utils/errors';
import { getUserId } from '../utils/normalizers';

function AnimatedReleaseCard({ item, index, cardWidth, navigation, showToast }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    const delay = Math.min(index * 38, 650);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 190, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay, friction: 8, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, scale, translateY]);

  const openRelease = () => {
    const albumId = item?.id || item?.entityId || item?._id || item?.album_id;
    if (!albumId) {
      showToast('Album ID not available.');
      return;
    }
    navigation.navigate('AlbumDetailsScreen', { albumId });
  };

  return (
    <Animated.View style={{ width: cardWidth, opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity style={styles.releaseCard} onPress={openRelease} activeOpacity={0.86}>
        <Image source={{ uri: item.image || item.cover_image }} style={styles.releaseImage} contentFit="cover" cachePolicy="memory-disk" transition={180} />
        <Text style={styles.releaseName} numberOfLines={2}>{item.title || item.name}</Text>
        <Text style={styles.releaseMeta} numberOfLines={1}>{item.release_date}{item.total_tracks ? ` · ${item.total_tracks} tracks` : ''}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ArtistReleasesScreen({ route, navigation: navigationProp }) {
  const fallbackNavigation = useNavigation();
  const navigation = navigationProp || fallbackNavigation;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { axiosInstance, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const userId = getUserId(user);
  const artistId = route?.params?.artistId;
  const artistName = route?.params?.artistName || 'Artist';
  const releaseType = route?.params?.releaseType === 'singles' ? 'singles' : 'albums';

  const artistDetailsQuery = useQuery({
    queryKey: queryKeys.artistDetails(artistId, userId),
    enabled: Boolean(artistId && userId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get(`/mobile/entity/artist/${encodeURIComponent(artistId)}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (artistDetailsQuery.isError) {
      showToast(getApiErrorMessage(artistDetailsQuery.error, 'No se pudieron cargar los lanzamientos.'));
    }
  }, [artistDetailsQuery.error, artistDetailsQuery.isError, showToast]);

  const releases = useMemo(() => (
    releaseType === 'singles'
      ? artistDetailsQuery.data?.singles || []
      : artistDetailsQuery.data?.albums || []
  ), [artistDetailsQuery.data, releaseType]);

  const title = releaseType === 'singles' ? 'Singles & EPs' : 'Albums';
  const subtitle = releaseType === 'singles' ? 'Singles, EPs, and short releases' : 'Full-length projects';
  const cardWidth = Math.floor((width - 48) / 2);

  if (artistDetailsQuery.isLoading && releases.length === 0) {
    return <DetailSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}> 
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.84}>
          <Icon name="chevron-left" size={18} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>{subtitle}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.artistName} numberOfLines={1}>{artistName}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{releases.length}</Text>
        </View>
      </View>

      <FlatList
        data={releases}
        numColumns={2}
        keyExtractor={(item, index) => `${item.id || item.entityId || item.name}-${index}`}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <AnimatedReleaseCard item={item} index={index} cardWidth={cardWidth} navigation={navigation} showToast={showToast} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="music" size={28} color="#F4E7C5" />
            <Text style={styles.emptyTitle}>No releases found</Text>
            <Text style={styles.emptyText}>Try again after Spotify metadata refreshes.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#211B2A',
    borderBottomWidth: 1,
    borderColor: 'rgba(244,231,197,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    color: '#F4E7C5',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 3,
  },
  artistName: {
    color: '#BBA7FF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  countPill: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F4E7C5',
    alignItems: 'center',
  },
  countText: {
    color: '#171515',
    fontSize: 13,
    fontWeight: '900',
  },
  gridContent: {
    padding: 16,
    paddingBottom: 130,
  },
  gridRow: {
    gap: 16,
    marginBottom: 18,
  },
  releaseCard: {
    borderRadius: 24,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.065)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  releaseImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    marginBottom: 9,
  },
  releaseName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  releaseMeta: {
    color: '#AFA7B7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  emptyState: {
    marginTop: 80,
    padding: 24,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.055)',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    color: '#AFA7B7',
    fontSize: 13,
    textAlign: 'center',
  },
});
