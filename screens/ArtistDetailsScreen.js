import React, { useState, useEffect, useContext, useRef } from 'react';
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
import { AuthContext } from '../context/AuthContext';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating';
import RatingDistribution from '../components/RatingDistribution';
import { DetailSkeleton } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { useFavorites } from '../hooks/useFavorites';
import { useRating } from '../hooks/useRating';
import { getApiErrorMessage } from '../utils/errors';
import { applyRatingDistributionChange, distributionWithUserFallback, hasRatingDistribution } from '../utils/ratingDistribution';

const HEADER_MAX = 340;

const ArtistDetailsScreen = ({ route, navigation: navigationProp }) => {
  const fallbackNavigation = useNavigation();
  const navigation = navigationProp || fallbackNavigation;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const scrollY = useRef(new Animated.Value(0)).current;
  const commentRef = useRef(null);
  const promptScale = useRef(new Animated.Value(0.96)).current;
  const { axiosInstance, user } = useContext(AuthContext);

  const { artistId: routeArtistId, artist: routeArtist } = route.params;
  const artistId = routeArtistId || (routeArtist && routeArtist.id);

  const [artistData, setArtistData] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState({});
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  const { favorites, invalidateFavorites } = useFavorites();
  const userRatingQuery = useRating({
    entityType: 'artist',
    entityId: artistId,
    enabled: Boolean(artistData?.artist?.id),
    name: artistData?.artist?.name,
    image: artistData?.artist?.image,
    artist: artistData?.artist?.name,
  });

  const artistDetailsQuery = useQuery({
    queryKey: queryKeys.artistDetails(artistId),
    enabled: Boolean(artistId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/artist_details', {
        params: { artist_id: artistId },
      });
      return response.data;
    },
  });

  useEffect(() => {
    if (!artistId) {
      showToast('No se proporcionó el ID del artista.');
      return;
    }
    if (!artistDetailsQuery.data) return;
    setArtistData(artistDetailsQuery.data);
    setAverageRating(artistDetailsQuery.data.artist.averageRating || 0);
    setRatingCount(artistDetailsQuery.data.artist.ratingCount || 0);
    setRatingDistribution(artistDetailsQuery.data.artist.ratingDistribution || {});
  }, [artistDetailsQuery.data, artistId, showToast]);

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
    setIsFavorite(favorites.some((fav) => fav.entityId === artistId && fav.entityType === 'artist'));
  }, [artistId, favorites]);

  useEffect(() => {
    if (userRatingQuery.data) setUserRating(userRatingQuery.data);
  }, [userRatingQuery.data]);

  const handleToggleFavorite = async () => {
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);
    try {
      if (!nextFavorite) {
        await axiosInstance.post('/remove_favorite', {
          entityType: 'artist',
          entityId: artistId,
        });
      } else {
        await axiosInstance.post('/add_favorite', {
          entityType: 'artist',
          entityId: artistId,
          name: artistData.artist.name,
          image: artistData.artist.image,
          artist: artistData.artist.name,
        });
      }
      invalidateFavorites();
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

  if (!artistData) {
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
            <Text style={styles.statValue}>{artistData.albums?.length || 0}</Text>
            <Text style={styles.statLabel}>Albums</Text>
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

        {/* Albums */}
        {artistData.albums && artistData.albums.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Albums</Text>
            <View style={styles.albumsGrid}>
              {artistData.albums.map((album, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.albumItem,
                    index % 2 === 0 ? styles.albumItemLarge : styles.albumItemSmall,
                  ]}
                  onPress={() => {
                    const targetId = album?.id || album?._id || album?.album_id;
                    if (!targetId) {
                      showToast('Album ID not available.');
                      return;
                    }
                    navigation.navigate('AlbumDetailsScreen', {
                      album: { id: targetId, name: album?.title, cover_image: album?.image },
                      albumId: targetId,
                    });
                  }}
                >
                  <Image
                    source={{ uri: album.image }}
                    style={[
                      styles.albumCover,
                      index % 2 === 0 ? styles.albumCoverLarge : styles.albumCoverSmall,
                    ]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={180}
                  />
                  <Text style={styles.albumName} numberOfLines={2}>{album.title}</Text>
                  <Text style={styles.albumYear}>{album.release_date}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Comments */}
        <View style={styles.card}>
          <CommentSection
            ref={commentRef}
            entityType="artist"
            entityId={artistData.artist.id}
            userRating={userRating}
          />
        </View>

        </Animated.ScrollView>
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

  albumsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  albumItem: {
    alignItems: 'center',
  },
  albumItemLarge: {
    width: '55%',
  },
  albumItemSmall: {
    width: '40%',
    marginTop: 20,
  },
  albumCover: {
    width: '100%',
    borderRadius: 18,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  albumCoverLarge: {
    height: 150,
  },
  albumCoverSmall: {
    height: 110,
    borderRadius: 14,
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
  },

});

export default ArtistDetailsScreen;
