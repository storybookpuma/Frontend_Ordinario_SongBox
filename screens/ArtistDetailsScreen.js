import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating';
import { DetailSkeleton } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { useFavorites } from '../hooks/useFavorites';
import { useRating } from '../hooks/useRating';
import { getApiErrorMessage } from '../utils/errors';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const HEADER_MAX = 340;
const HEADER_MIN = 120;

const ArtistDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { axiosInstance, user } = useContext(AuthContext);

  const { artistId: routeArtistId, artist: routeArtist } = route.params;
  const artistId = routeArtistId || (routeArtist && routeArtist.id);

  const [artistData, setArtistData] = useState(null);
  const [comments, setComments] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [newComment, setNewComment] = useState('');

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

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, (HEADER_MAX - HEADER_MIN) * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
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
  }, [artistDetailsQuery.data, artistId, showToast]);

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
        },
      });
    } catch (error) {
      setUserRating(previousRating);
      showToast(getApiErrorMessage(error, 'No se pudo registrar tu calificación.'));
    }
  };

  const sortComments = (commentsList) => {
    return [...commentsList].sort((a, b) => b.likes - a.likes);
  };

  const handlePostComment = async () => {
    if (newComment.trim().length === 0) {
      showToast('El comentario no puede estar vacío.');
      return;
    }
    try {
      const response = await axiosInstance.post(`/artist/${artistData.artist.id}/comments`, {
        comment_text: newComment,
        name: artistData?.artist?.name,
        image: artistData?.artist?.image,
        artist: artistData?.artist?.name,
      });
      const updatedComments = sortComments([response.data.comment, ...comments]);
      setComments(updatedComments);
      setNewComment('');
      Keyboard.dismiss();
    } catch (_error) {
      showToast('No se pudo agregar el comentario. Verifica la conexión.');
    }
  };

  if (!artistData) {
    return <DetailSkeleton />;
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        keyboardShouldPersistTaps="handled"
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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <AnimatedImage
            source={{ uri: artistData.artist.image }}
            style={[styles.heroCover, { opacity: imageOpacity }]}
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
                    navigation.navigate('AlbumDetailsScreen', { album: { id: album.id } });
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
          <Text style={styles.cardTitle}>Comments</Text>
          <CommentSection
            entityType="artist"
            entityId={artistData.artist.id}
            comments={comments}
            onAddComment={setComments}
            navigation={navigation}
          />
        </View>

        {/* Comment Input */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Write a comment..."
            placeholderTextColor="#888"
            value={newComment}
            onChangeText={setNewComment}
            multiline
            numberOfLines={2}
          />
          <TouchableOpacity style={styles.postButton} onPress={handlePostComment}>
            <Icon name="paper-plane" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  scrollContent: {
    paddingBottom: 24,
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

  inputCard: {
    marginHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 80,
    textAlignVertical: 'top',
  },
  postButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#A071CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ArtistDetailsScreen;
