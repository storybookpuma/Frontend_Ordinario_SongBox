import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating';
import { AuthContext } from '../context/AuthContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'; 
import { DetailSkeleton } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { useToast } from '../context/ToastContext';
import { useFavorites } from '../hooks/useFavorites';
import { useRating } from '../hooks/useRating';
import { getApiErrorMessage } from '../utils/errors';

export default function SongDetailsScreen({ route }) {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { height: screenHeight } = useWindowDimensions();
  const { axiosInstance, user } = useContext(AuthContext);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { songId: routeSongId, song: routeSong } = route.params;

  const songId = routeSongId || (routeSong && routeSong.id);

  const [songData, setSongData] = useState(null);
  const [loadingSongImage, setLoadingSongImage] = useState(true);
  const [comments, setComments] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false); 

  // Estados para calificaciones
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

  useEffect(() => {
    if (!songId) {
      showToast('No se proporcionó el ID de la canción.');
      navigation.goBack();
    }
  }, [navigation, songId, showToast]);

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.5, 1],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp'
  });

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
        // Eliminar de favoritos
        await axiosInstance.post('/remove_favorite', {
          entityType: 'song',
          entityId: songId,
        });
      } else {
        // Agregar a favoritos
        await axiosInstance.post('/add_favorite', {
          entityType: 'song',
          entityId: songId,
          name: songData.name,
          image: songData.cover_image,
          artist: songData.artists?.join(', '),
        });
      }
      invalidateFavorites();
    } catch (error) {
      setIsFavorite(!nextFavorite);
      console.error('Error al actualizar favorito:', error);
      showToast('No se pudieron actualizar los favoritos.');
    }
  };

  const handlePlayPress = () => {
    if (songData.preview_url) {
      Linking.openURL(songData.preview_url);
    } else if (songData.url) {
      Linking.openURL(songData.url);
    } else {
      Alert.alert('Error', 'No hay URL disponible para reproducir esta canción.');
    }
  };

  const handleRatingChange = async (rating) => {
    if (!user) {
      Alert.alert('Autenticación requerida', 'Debes iniciar sesión para calificar.');
      return;
    }

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
      showToast("El comentario no puede estar vacío.");
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
    } catch (_error) {
      showToast("No se pudo agregar el comentario. Verifica la conexión.");
    }
  };

  const sortComments = (commentsList) => {
    return [...commentsList].sort((a, b) => b.likes - a.likes);
  };

  if (!songData) {
    return <DetailSkeleton />;
  }

  return (
    <KeyboardAwareScrollView
      style={styles.keyboardAwareContainer}
      contentContainerStyle={styles.scrollContainer}
      enableOnAndroid={true}
      extraScrollHeight={20}
      keyboardShouldPersistTaps='handled' 
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          <View style={styles.backgroundGlow}>
            {loadingSongImage && (
              <ActivityIndicator size="large" color="#A071CA" style={styles.songImageLoader} />
            )}
            <Image 
              source={{ uri: songData.cover_image || 'https://via.placeholder.com/500' }}  
              style={styles.blurredBackground}
              blurRadius={50}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={220}
              placeholder={require('../assets/default_picture.png')}
              onLoadStart={() => setLoadingSongImage(true)}
              onLoadEnd={() => setLoadingSongImage(false)}
            />
          </View>

          {/* Botón de cierre */}
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Icon name="times" size={30} color="#FFF" />
          </TouchableOpacity>

          {/* Imagen de la canción con efecto de escala */}
          <Animated.View style={[
            styles.songImageContainer,
            { height: screenHeight * 0.5, transform: [{ scale: imageScale }] }
          ]}>
            {loadingSongImage && (
              <ActivityIndicator size="large" color="#A071CA" style={styles.songImageLoader} />
            )}
            <Image 
              source={{ uri: songData.cover_image || 'https://via.placeholder.com/500' }}  
              style={styles.songImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={220}
              placeholder={require('../assets/default_picture.png')}
              onLoadStart={() => setLoadingSongImage(true)}
              onLoadEnd={() => setLoadingSongImage(false)}
            />
          </Animated.View>

          <View style={styles.contentContainer}>
            {/* Título de la canción y botón de favorito */}
            <View style={styles.headerContainer}>
              <Text style={styles.songTitle}>{songData.name}</Text>
              <FavoriteButton isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
            </View>

            {/* Artistas */}
            <TouchableOpacity
              onPress={() => {
                if (songData.artist_ids && songData.artist_ids.length > 0) {
                  navigation.navigate('ArtistDetailsScreen', {
                    artistId: songData.artist_ids[0],
                    artistName: songData.artists[0],
                  });
                } else {
                  showToast('No se pudo obtener la información del artista.');
                }
              }}
            >
              <Text style={styles.songArtists}>by {songData.artists.join(', ')}</Text>
            </TouchableOpacity>

            {/* Álbum */}
            <TouchableOpacity
              onPress={() => {
                if (songData.album_id) {
                  navigation.navigate('AlbumDetailsScreen', {
                    album: { id: songData.album_id },
                  });
                } else {
                  showToast('No se pudo obtener la información del álbum.');
                }
              }}
            >
              <Text style={styles.albumText}>
                Álbum: {songData.album || 'Desconocido'}
              </Text>
            </TouchableOpacity>

            {/* Popularidad */}
            {songData.popularity !== undefined && (
              <Text style={styles.popularityText}>
                Popularidad: {songData.popularity}
              </Text>
            )}

            {/* Seguidores de los artistas */}
            {songData.followers !== undefined && (
              <Text style={styles.followersText}>
                Seguidores de los artistas: {songData.followers.toLocaleString()}
              </Text>
            )}

            {/* Géneros de los artistas */}
            {songData.genres && songData.genres.length > 0 && (
              <Text style={styles.genresText}>
                Géneros: {songData.genres.join(', ')}
              </Text>
            )}

            {/* Botón para reproducir la canción */}
            <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
              <Text style={styles.playButtonText}>Reproducir</Text>
            </TouchableOpacity>

            {/* Sección de calificaciones */}
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>
                {userRating > 0 ? 'Tu calificación' : 'Califica esta canción'}
              </Text>
              <StarRating
                maxStars={10}
                currentRating={userRating}
                onRatingChange={handleRatingChange}
                editable={Boolean(user)}
                isLoading={userRatingQuery.isMutating}
              />
              {userRating > 0 && (
                <TouchableOpacity onPress={() => handleRatingChange(0)} disabled={userRatingQuery.isMutating}>
                  <Text style={styles.deleteRatingText}>Eliminar calificación</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.averageRatingText}>
                Promedio de calificaciones: {averageRating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? 'calificación' : 'calificaciones'})
              </Text>
            </View>

            {/* Sección de comentarios */}
            <CommentSection
              entityType="song"
              entityId={songData.id}
              comments={comments}
              onAddComment={setComments}
              navigation={navigation}
            />

            {/* Campo de entrada para comentarios */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Escribe un comentario..."
                placeholderTextColor="#888"
                value={newComment}
                onChangeText={setNewComment}
                multiline={true}
                numberOfLines={3}
              />
              <TouchableOpacity style={styles.postButton} onPress={handlePostComment}>
                <Text style={styles.postButtonText}>Publicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  keyboardAwareContainer: {
    flex: 1,
    backgroundColor: '#171515',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 0, 
    paddingVertical: 10,  
  },
  innerContainer: {
    flex: 1,
  },
  backgroundGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  blurredBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  songImageLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
    zIndex: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  songImageContainer: {
    width: '100%',
    marginTop: -50,
  },
  songImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: 0, 
    paddingTop: 20,        
    backgroundColor: 'rgba(23, 21, 21, 0.9)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10, 
  },
  songTitle: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 5,
    flex: 1,
    flexWrap: 'wrap',
  },
  songArtists: {
    fontSize: 18,
    color: '#A071CA',
    marginBottom: 5,
    paddingHorizontal: 10, 
  },
  albumText: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 5,
    paddingHorizontal: 10, 
  },
  popularityText: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 5,
    paddingHorizontal: 10, 
  },
  followersText: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 5,
    paddingHorizontal: 10, 
  },
  genresText: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 20,
    paddingHorizontal: 10, 
  },
  playButton: {
    backgroundColor: '#A071CA',
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
    alignSelf: 'stretch',
    width: '100%',        
    marginHorizontal: 0,  
  },
  playButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center', 
  },
  ratingSection: {
    marginBottom: 20,
    paddingHorizontal: 10, 
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  averageRatingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  deleteRatingText: {
    color: '#E74C3C',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,  
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end', 
    borderTopWidth: 1,
    borderColor: '#444',
    paddingTop: 5,          
    marginTop: 5,           
    paddingHorizontal: 10,  
  },
  input: {
    flex: 1,
    backgroundColor: '#2c2c2c',
    color: '#fff',
    padding: 10,
    borderRadius: 10,
    marginRight: 10,
    textAlignVertical: 'top', 
    maxHeight: 100, 
  },
  postButton: {
    backgroundColor: '#A071CA',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignSelf: 'flex-end', 
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
