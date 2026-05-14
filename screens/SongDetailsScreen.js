import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  Keyboard,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { useFavorites } from '../hooks/useFavorites';
import { useRating } from '../hooks/useRating';
import { getApiErrorMessage } from '../utils/errors';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const HEADER_MAX = 340;
const HEADER_MIN = 120;

export default function SongDetailsScreen({ route }) {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { axiosInstance, user } = useContext(AuthContext);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { songId: routeSongId, song: routeSong } = route.params;
  const songId = routeSongId || (routeSong && routeSong.id);

  const [songData, setSongData] = useState(null);
  const [comments, setComments] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [newComment, setNewComment] = useState('');

  const { favorites, invalidateFavorites } = useFavorites();
  const userRatingQuery = useRating({
    entityType: 'song',
    entityId: songId,
    enabled: Boolean(songData),
    name: songData?.name,
    image: songData?.cover_image,
    artist: songData?.artists?.join(', '),
  });

  const songDetailsQuery = useQuery({
    queryKey: queryKeys.songDetails(songId),
    enabled: Boolean(songId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/song_details', {
        params: { song_id: songId },
      });
      return response.data.song;
    },
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, (HEADER_MAX - HEADER_MIN) * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (!songId) {
      showToast('No se proporcionó el ID de la canción.');
      navigation.goBack();
    }
  }, [navigation, songId, showToast]);

  useEffect(() => {
    if (!songDetailsQuery.data) return;
    setSongData(songDetailsQuery.data);
    setAverageRating(songDetailsQuery.data.averageRating || 0);
    setRatingCount(songDetailsQuery.data.ratingCount || 0);
  }, [songDetailsQuery.data]);

  useEffect(() => {
    if (songDetailsQuery.isError) {
      showToast(getApiErrorMessage(songDetailsQuery.error, 'Hubo un problema al cargar los detalles de la canción.'));
    }
  }, [showToast, songDetailsQuery.error, songDetailsQuery.isError]);

  useEffect(() => {
    setIsFavorite(favorites.some((fav) => fav.entityId === songId && fav.entityType === 'song'));
  }, [favorites, songId]);

  useEffect(() => {
    if (userRatingQuery.data) setUserRating(userRatingQuery.data);
  }, [userRatingQuery.data]);

  const handleToggleFavorite = async () => {
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);
    try {
      if (!nextFavorite) {
        await axiosInstance.post('/remove_favorite', {
          entityType: 'song',
          entityId: songId,
        });
      } else {
        await axiosInstance.post('/add_favorite', {
          entityType: 'song',
          entityId: songId,
          name: songData.name,
          image: songData.cover_image,
          artist: songData.artists?.join(', '),
        });
      }
      invalidateFavorites();
    } catch (_error) {
      setIsFavorite(!nextFavorite);
      showToast('No se pudieron actualizar los favoritos.');
    }
  };

  const handlePlayPress = () => {
    if (songData.preview_url) {
      Linking.openURL(songData.preview_url);
    } else if (songData.url) {
      Linking.openURL(songData.url);
    } else {
      showToast('No hay URL disponible para reproducir esta canción.');
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

  const handlePostComment = async () => {
    if (newComment.trim().length === 0) {
      showToast('El comentario no puede estar vacío.');
      return;
    }
    try {
      const response = await axiosInstance.post(`/song/${songId}/comments`, {
        comment_text: newComment,
        name: songData?.name,
        image: songData?.cover_image,
        artist: songData?.artists?.join(', '),
      });
      const updatedComments = sortComments([response.data.comment, ...comments]);
      setComments(updatedComments);
      setNewComment('');
      Keyboard.dismiss();
    } catch (_error) {
      showToast('No se pudo agregar el comentario. Verifica la conexión.');
    }
  };

  const sortComments = (commentsList) => {
    return [...commentsList].sort((a, b) => b.likes - a.likes);
  };

  if (!songData) {
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
            source={{ uri: songData.cover_image }}
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
            source={{ uri: songData.cover_image }}
            style={[styles.heroCover, { opacity: imageOpacity }]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>{songData.name}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (songData.artist_ids?.length > 0) {
                    navigation.navigate('ArtistDetailsScreen', {
                      artistId: songData.artist_ids[0],
                      artistName: songData.artists[0],
                    });
                  }
                }}
              >
                <Text style={styles.subtitle}>{songData.artists.join(', ')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (songData.album_id) {
                    navigation.navigate('AlbumDetailsScreen', { album: { id: songData.album_id } });
                  }
                }}
              >
                <Text style={styles.meta}>{songData.album}</Text>
              </TouchableOpacity>
            </View>
            <FavoriteButton isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
          </View>

          {/* Play button */}
          <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
            <Icon name="play" size={16} color="#FFF" />
            <Text style={styles.playText}>Preview</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {songData.popularity !== undefined && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{songData.popularity}</Text>
              <Text style={styles.statLabel}>Popularity</Text>
            </View>
          )}
          {songData.followers !== undefined && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{(songData.followers / 1000000).toFixed(1)}M</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          )}
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.floor(songData.duration_ms / 60000)}:{String(Math.floor((songData.duration_ms % 60000) / 1000)).padStart(2, '0')}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        {/* Genres */}
        {songData.genres && songData.genres.length > 0 && (
          <View style={styles.genresWrap}>
            {songData.genres.map((g, i) => (
              <View key={i} style={styles.genrePill}>
                <Text style={styles.genreText}>{g}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Rating Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{userRating > 0 ? 'Your Rating' : 'Rate this Song'}</Text>
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

        {/* Comments */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comments</Text>
          <CommentSection
            entityType="song"
            entityId={songData.id}
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
}

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

  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: '#A071CA',
    alignSelf: 'stretch',
  },
  playText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
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

  genresWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  genrePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(160,113,202,0.15)',
  },
  genreText: {
    color: '#D9D0E7',
    fontSize: 12,
    fontWeight: '600',
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
  deleteRating: {
    color: '#E74C3C',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
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
