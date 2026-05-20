import React, { useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating';
import RatingDistribution from '../components/RatingDistribution';
import { DetailSkeleton } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { useFavorites } from '../hooks/useFavorites';
import { useEntityDetailUiState } from '../hooks/useEntityDetailUiState';
import { useRating } from '../hooks/useRating';
import { getApiErrorMessage } from '../utils/errors';
import { getUserId } from '../utils/normalizers';
import { applyRatingDistributionChange, distributionWithUserFallback, hasRatingDistribution } from '../utils/ratingDistribution';

const HEADER_MAX = 340;

function ArtistReleaseSection({ title, subtitle, releaseType, releases, artistId, artistName, navigation, showToast }) {
  if (!releases || releases.length === 0) return null;
  const previewReleases = releases.slice(0, 8);
  return (
    <View style={styles.card}>
      <View style={styles.releaseHeaderRow}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.releaseSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.releaseHeaderActions}>
          <Text style={styles.releaseCount}>{releases.length}</Text>
          <TouchableOpacity
            style={styles.showAllButton}
            onPress={() => navigation.navigate('ArtistReleasesScreen', { artistId, artistName, releaseType })}
            activeOpacity={0.84}
          >
            <Text style={styles.showAllText}>Mostrar todos</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        horizontal
        data={previewReleases}
        keyExtractor={(item, index) => `${item.id || item.entityId || item.name}-${index}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.releaseCarousel}
        renderItem={({ item: album }) => (
          <TouchableOpacity
            style={styles.releaseCarouselItem}
            onPress={() => {
              const targetId = album?.id || album?._id || album?.album_id;
              if (!targetId) {
                showToast('Album ID not available.');
                return;
              }
              navigation.navigate('AlbumDetailsScreen', { albumId: targetId });
            }}
          >
            <Image
              source={{ uri: album.image || album.cover_image }}
              style={styles.releaseCarouselCover}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={180}
            />
            <Text style={styles.albumName} numberOfLines={2}>{album.title || album.name}</Text>
            <Text style={styles.albumYear}>{album.release_date}{album.total_tracks ? ` · ${album.total_tracks} tracks` : ''}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const ArtistDetailsScreen = ({ route, navigation: navigationProp }) => {
  const fallbackNavigation = useNavigation();
  const navigation = navigationProp || fallbackNavigation;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const scrollY = useRef(new Animated.Value(0)).current;
  const commentRef = useRef(null);
  const promptScale = useRef(new Animated.Value(0.96)).current;
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  const artistId = route?.params?.artistId;

  const { favorites, toggleFavorite } = useFavorites();

  const artistDetailsQuery = useQuery({
    queryKey: queryKeys.artistDetails(artistId, userId),
    enabled: Boolean(artistId && userId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get(`/mobile/entity/artist/${encodeURIComponent(artistId)}`);
      return response.data;
    },
  });

  const {
    entityData: artistData,
    isFavorite,
    setIsFavorite,
    userRating,
    setUserRating,
    averageRating,
    setAverageRating,
    ratingCount,
    setRatingCount,
    ratingDistribution,
    setRatingDistribution,
    showReviewPrompt,
    setShowReviewPrompt,
    isDetailReady,
  } = useEntityDetailUiState(artistId, artistDetailsQuery, 'artist');

  const userRatingQuery = useRating({
    entityType: 'artist',
    entityId: artistId,
    enabled: false,
    name: artistData?.artist?.name,
    image: artistData?.artist?.image,
    artist: artistData?.artist?.name,
  });

  useEffect(() => {
    if (!artistId) {
      showToast('No se proporcionó el ID del artista.');
    }
  }, [artistId, showToast]);

  useEffect(() => {
    Animated.spring(promptScale, {
      toValue: showReviewPrompt ? 1 : 0.96,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [promptScale, showReviewPrompt]);

  useEffect(() => {
    if (artistDetailsQuery.isError) {
      showToast(getApiErrorMessage(artistDetailsQuery.error, 'Hubo un problema al cargar los datos del artista.'));
    }
  }, [artistDetailsQuery.error, artistDetailsQuery.isError, showToast]);

  useEffect(() => {
    if (!artistDetailsQuery.data) {
      setIsFavorite(favorites.some((fav) => fav.entityId === artistId && fav.entityType === 'artist'));
    }
  }, [artistDetailsQuery.data, artistId, favorites]);

  const handleToggleFavorite = async () => {
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);
    try {
      if (!nextFavorite) {
        await toggleFavorite({
          entityType: 'artist',
          entityId: artistId,
          isFavorite: true,
        });
      } else {
        await toggleFavorite({
          entityType: 'artist',
          entityId: artistId,
          isFavorite: false,
          favorite: {
            name: artistData.artist.name,
            image: artistData.artist.image,
            artist: artistData.artist.name,
          },
        });
      }
    } catch (_error) {
      setIsFavorite(!nextFavorite);
      showToast('No se pudieron actualizar los favoritos.');
    }
  };

  const handleRatingChange = async (rating) => {
    if (!user) return;
    if (rating === 0 && userRating > 0) {
      try {
        await userRatingQuery.deleteRating({
          currentRating: userRating,
          setUserRating,
          onSuccess: (data) => {
            setAverageRating(data.averageRating);
            setRatingCount(data.ratingCount);
            setRatingDistribution(hasRatingDistribution(data.ratingDistribution) ? data.ratingDistribution : applyRatingDistributionChange(ratingDistribution, userRating, 0));
            setShowReviewPrompt(false);
          },
        });
      } catch (error) {
        showToast(getApiErrorMessage(error, 'No se pudo eliminar tu calificación.'));
      }
      return;
    }
    if (rating === 0) return;
    const previousRating = userRating;
    try {
      await userRatingQuery.rateEntity({
        rating,
        currentRating: previousRating,
        setUserRating,
        onSuccess: (data) => {
          setAverageRating(data.averageRating);
          setRatingCount(data.ratingCount);
          setRatingDistribution(hasRatingDistribution(data.ratingDistribution) ? data.ratingDistribution : applyRatingDistributionChange(ratingDistribution, previousRating, rating));
          setShowReviewPrompt(true);
        },
      });
    } catch (error) {
      setUserRating(previousRating);
      showToast(getApiErrorMessage(error, 'No se pudo registrar tu calificación.'));
    }
  };

  const scrollRef = useRef(null);

  const focusCommentInput = () => {
    commentRef.current?.open();
  };

  if (!isDetailReady) {
    return <DetailSkeleton />;
  }

  const displayedRatingDistribution = distributionWithUserFallback(ratingDistribution, userRating);

  return (
    <View style={styles.container} collapsable={false}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
        {/* Hero */}
        <View style={[styles.hero, { height: HEADER_MAX }]}>
          <Image
            source={{ uri: artistData.artist.image }}
            style={styles.heroImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['transparent', 'rgba(23,21,21,0.6)', '#171515']}
            locations={[0, 0.5, 1]}
            style={styles.heroGradient}
          />
          <TouchableOpacity style={[styles.backButton, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Image
            source={{ uri: artistData.artist.image }}
            style={styles.heroCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>{artistData.artist.name}</Text>
              <Text style={styles.subtitle}>
                {artistData.artist.genres?.slice(0, 3).join(' · ')}
              </Text>
            </View>
            <FavoriteButton isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{artistData.artist.popularity}</Text>
            <Text style={styles.statLabel}>Popularity</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{(artistData.artist.followers / 1000000).toFixed(1)}M</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{(artistData.albums?.length || 0) + (artistData.singles?.length || 0)}</Text>
            <Text style={styles.statLabel}>Releases</Text>
          </View>
        </View>

        {/* Rating Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{userRating > 0 ? 'Your Rating' : 'Rate this Artist'}</Text>
          <StarRating
            maxStars={10}
            currentRating={userRating}
            onRatingChange={handleRatingChange}
            editable={Boolean(user)}
            isLoading={userRatingQuery.isMutating}
          />
          <View style={styles.ratingMeta}>
            <Text style={styles.ratingScore}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}> ({ratingCount})</Text>
          </View>
          <RatingDistribution distribution={displayedRatingDistribution} total={ratingCount} />
          {showReviewPrompt && (
            <Animated.View style={[styles.reviewPrompt, { transform: [{ scale: promptScale }] }]}> 
              <View>
                <Text style={styles.reviewPromptTitle}>Tell us why</Text>
                <Text style={styles.reviewPromptText}>Turn that rating into a quick take.</Text>
              </View>
              <TouchableOpacity style={styles.reviewPromptButton} onPress={focusCommentInput} activeOpacity={0.86}>
                <Text style={styles.reviewPromptButtonText}>Review</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {userRating > 0 && (
            <TouchableOpacity onPress={() => handleRatingChange(0)} disabled={userRatingQuery.isMutating}>
              <Text style={styles.deleteRating}>Eliminar calificación</Text>
            </TouchableOpacity>
          )}
        </View>

        <ArtistReleaseSection
          title="Albums"
          subtitle="Full-length projects"
          releaseType="albums"
          releases={artistData.albums}
          artistId={artistId}
          artistName={artistData.artist.name}
          navigation={navigation}
          showToast={showToast}
        />
        <ArtistReleaseSection
          title="Singles & EPs"
          subtitle="Singles, EPs, and shorter releases"
          releaseType="singles"
          releases={artistData.singles}
          artistId={artistId}
          artistName={artistData.artist.name}
          navigation={navigation}
          showToast={showToast}
        />

        {/* Comments */}
        <View style={styles.card}>
          <CommentSection
            ref={commentRef}
            entityType="artist"
            entityId={artistData.artist.id}
            userRating={userRating}
            initialCount={artistData.artist.commentCount || 0}
          />
        </View>

        </Animated.ScrollView>

        <Animated.View
          style={[
            styles.stickyHeader,
            {
              top: insets.top + 8,
              opacity: scrollY.interpolate({
                inputRange: [HEADER_MAX * 0.45, HEADER_MAX * 0.7],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [{
                translateY: scrollY.interpolate({
                  inputRange: [HEADER_MAX * 0.45, HEADER_MAX * 0.7],
                  outputRange: [-14, 0],
                  extrapolate: 'clamp',
                }),
              }],
            },
          ]}
        >
          <TouchableOpacity style={styles.stickyBackButton} onPress={() => navigation.goBack()} activeOpacity={0.82}>
            <Icon name="chevron-left" size={18} color="#FFF" />
          </TouchableOpacity>
          <Image
            source={{ uri: artistData.artist.image }}
            style={styles.stickyImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.stickyTextWrap}>
            <Text style={styles.stickyTitle} numberOfLines={1}>{artistData.artist.name}</Text>
            <Text style={styles.stickySubtitle} numberOfLines={1}>{artistData.artist.genres?.slice(0, 3).join(' · ')}</Text>
          </View>
        </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  scrollContent: {
    paddingBottom: 120,
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCover: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 160,
    height: 160,
    borderRadius: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 8,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  stickyHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(23,21,21,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
    zIndex: 100,
  },
  stickyBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  stickyTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  stickyTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  stickySubtitle: {
    color: '#BBA7FF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    color: '#FFF',
    fontWeight: '800',
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#BBA7FF',
    fontWeight: '600',
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 14,
  },
  releaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  releaseHeaderActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  releaseSubtitle: {
    color: '#AFA7B7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -8,
    marginBottom: 2,
  },
  releaseCount: {
    color: '#F4E7C5',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(244,231,197,0.12)',
  },
  showAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(244,231,197,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(244,231,197,0.16)',
  },
  showAllText: {
    color: '#F4E7C5',
    fontSize: 11,
    fontWeight: '900',
  },
  ratingMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  ratingScore: {
    fontSize: 22,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  ratingCount: {
    fontSize: 14,
    color: '#888',
  },
  reviewPrompt: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(160,113,202,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(160,113,202,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewPromptTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  reviewPromptText: {
    color: '#CFC5D8',
    fontSize: 12,
    marginTop: 2,
  },
  reviewPromptButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#A071CA',
  },
  reviewPromptButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteRating: {
    color: '#E74C3C',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },

  releaseCarousel: {
    paddingRight: 8,
    gap: 14,
  },
  releaseCarouselItem: {
    width: 150,
    padding: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  releaseCarouselCover: {
    width: '100%',
    height: 130,
    borderRadius: 18,
    marginBottom: 8,
  },
  albumName: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  albumYear: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },

});

export default ArtistDetailsScreen;
