import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { LinearGradient } from 'expo-linear-gradient';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating';
import RatingDistribution from '../components/RatingDistribution';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { useFavorites } from '../hooks/useFavorites';
import { useRating } from '../hooks/useRating';
import { getApiErrorMessage } from '../utils/errors';
import { applyRatingDistributionChange, distributionWithUserFallback, hasRatingDistribution } from '../utils/ratingDistribution';

const HEADER_MAX = 320;

const AlbumDetailsScreen = ({ route, navigation: navigationProp }) => {
  const fallbackNavigation = useNavigation();
  const navigation = navigationProp || fallbackNavigation;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const scrollY = useRef(new Animated.Value(0)).current;
  const commentRef = useRef(null);
  const promptScale = useRef(new Animated.Value(0.96)).current;
  const { axiosInstance, user } = useContext(AuthContext);

  const routeAlbumId = route?.params?.albumId;
  const album = useMemo(
    () => (routeAlbumId ? { id: routeAlbumId } : null),
    [routeAlbumId]
  );

  useEffect(() => {
    if (!album || !album.id) {
      showToast('No se pudo cargar la información del álbum.');
      navigation.goBack();
    }
  }, [album, navigation, showToast]);

  const [albumData, setAlbumData] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState({});
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  const { favorites, toggleFavorite } = useFavorites();
  const userRatingQuery = useRating({
    entityType: 'album',
    entityId: album?.id,
    enabled: false,
    name: albumData?.name,
    image: albumData?.cover_image,
    artist: albumData?.artists?.join(', '),
  });

  const albumDetailsQuery = useQuery({
    queryKey: queryKeys.albumDetails(album?.id),
    enabled: Boolean(album?.id && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get(`/mobile/entity/album/${encodeURIComponent(album?.id)}`);
      return response.data.album;
    },
  });

  useEffect(() => {
    if (!albumDetailsQuery.data) return;
    setAlbumData(albumDetailsQuery.data);
    setAverageRating(albumDetailsQuery.data.averageRating || 0);
    setRatingCount(albumDetailsQuery.data.ratingCount || 0);
    setRatingDistribution(albumDetailsQuery.data.ratingDistribution || {});
    setUserRating(albumDetailsQuery.data.userRating || 0);
    setIsFavorite(Boolean(albumDetailsQuery.data.isFavorite));
  }, [albumDetailsQuery.data]);

  useEffect(() => {
    Animated.spring(promptScale, {
      toValue: showReviewPrompt ? 1 : 0.96,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [promptScale, showReviewPrompt]);

  useEffect(() => {
    if (albumDetailsQuery.isError) {
      showToast(getApiErrorMessage(albumDetailsQuery.error, 'Hubo un problema al cargar los datos del álbum.'));
    }
  }, [albumDetailsQuery.error, albumDetailsQuery.isError, showToast]);

  useEffect(() => {
    if (!albumDetailsQuery.data) {
      setIsFavorite(favorites.some((fav) => fav.entityId === album?.id && fav.entityType === 'album'));
    }
  }, [album?.id, albumDetailsQuery.data, favorites]);

  const handleToggleFavorite = async () => {
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);
    try {
      if (!nextFavorite) {
        await toggleFavorite({
          entityType: 'album',
          entityId: album.id,
          isFavorite: true,
        });
      } else {
        await toggleFavorite({
          entityType: 'album',
          entityId: album.id,
          isFavorite: false,
          favorite: {
            name: albumData.name,
            image: albumData.cover_image,
            artist: albumData.artists?.join(', '),
          },
        });
      }
    } catch (_error) {
      setIsFavorite(!nextFavorite);
      showToast('No se pudieron actualizar los favoritos.');
    }
  };

  const formatDuration = (durationMs) => {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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

  if (!albumData) {
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
            source={{ uri: albumData.cover_image }}
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
            source={{ uri: albumData.cover_image }}
            style={styles.heroCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>{albumData.name}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (albumData.artist_ids?.length > 0) {
                    navigation.navigate('ArtistDetailsScreen', {
                      artistId: albumData.artist_ids[0],
                      artistName: albumData.artists[0],
                    });
                  }
                }}
              >
                <Text style={styles.subtitle}>{albumData.artists.join(', ')}</Text>
              </TouchableOpacity>
              <Text style={styles.meta}>{albumData.release_date} · {albumData.total_tracks} tracks</Text>
            </View>
            <FavoriteButton isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
          </View>
        </View>

        {/* Rating Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{userRating > 0 ? 'Your Rating' : 'Rate this Album'}</Text>
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

        {/* Tracks */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracks</Text>
          <View style={styles.tracksList}>
            {albumData.tracks.map((track, index) => (
              <TouchableOpacity
                key={track.id}
                style={[
                  styles.trackRow,
                  index !== albumData.tracks.length - 1 && styles.trackRowBorder,
                ]}
                onPress={() => navigation.navigate('SongDetailsScreen', { songId: track.id })}
              >
                <Text style={styles.trackNumber}>{track.track_number}</Text>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
                  <Text style={styles.trackArtists} numberOfLines={1}>
                    {track.artists?.join(', ') || albumData.artists.join(', ')}
                  </Text>
                </View>
                <Text style={styles.trackDuration}>{formatDuration(track.duration_ms)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Comments */}
        <View style={styles.card}>
          <CommentSection
            ref={commentRef}
            entityType="album"
            entityId={albumData.id}
            userRating={userRating}
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
            source={{ uri: albumData.cover_image }}
            style={styles.stickyImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.stickyTextWrap}>
            <Text style={styles.stickyTitle} numberOfLines={1}>{albumData.name}</Text>
            <Text style={styles.stickySubtitle} numberOfLines={1}>{albumData.artists.join(', ')}</Text>
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
    borderRadius: 20,
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
    borderRadius: 8,
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
    fontSize: 16,
    color: '#BBA7FF',
    fontWeight: '600',
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
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
    marginBottom: 12,
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

  tracksList: {
    gap: 0,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  trackRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  trackNumber: {
    width: 28,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    textAlign: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
  trackArtists: {
    fontSize: 12,
    color: '#A071CA',
    marginTop: 2,
  },
  trackDuration: {
    fontSize: 13,
    color: '#888',
  },

});

export default AlbumDetailsScreen;
