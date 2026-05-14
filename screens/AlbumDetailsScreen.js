import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated,
  ActivityIndicator,
  Alert,
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

const AlbumDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { height: screenHeight } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { axiosInstance, user } = useContext(AuthContext);

  const album = route?.params?.album;

  useEffect(() => {
    if (!album || !album.id) {
      showToast('No se pudo cargar la información del álbum.');
      navigation.goBack();
    }
  }, [album, navigation, showToast]);

  const [albumData, setAlbumData] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingAlbumImage, setLoadingAlbumImage] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Estados para calificaciones
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  const [newComment, setNewComment] = useState('');

  const { favorites, invalidateFavorites } = useFavorites();
  const userRatingQuery = useRating({
    entityType: 'album',
    entityId: album?.id,
    enabled: Boolean(album?.id && albumData),
    name: albumData?.name,
    image: albumData?.cover_image,
    artist: albumData?.artists?.join(', '),
  });

  const albumDetailsQuery = useQuery({
    queryKey: queryKeys.albumDetails(album?.id),
    enabled: Boolean(album?.id && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/album_details', {
        params: { album_id: album?.id },
      });
      return response.data.album;
    },
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.5, 1],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp'
  });

  useEffect(() => {
    if (!albumDetailsQuery.data) return;
    setAlbumData(albumDetailsQuery.data);
    setAverageRating(albumDetailsQuery.data.averageRating || 0);
    setRatingCount(albumDetailsQuery.data.ratingCount || 0);
  }, [albumDetailsQuery.data]);

  useEffect(() => {
    if (albumDetailsQuery.isError) {
      showToast(getApiErrorMessage(albumDetailsQuery.error, 'Hubo un problema al cargar los datos del álbum.'));
    }
  }, [albumDetailsQuery.error, albumDetailsQuery.isError, showToast]);

  useEffect(() => {
    setIsFavorite(favorites.some((fav) => fav.entityId === album.id && fav.entityType === 'album'));
  }, [album.id, favorites]);

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
          entityType: 'album',
          entityId: album.id,
        });
      } else {
        // Agregar a favoritos
        await axiosInstance.post('/add_favorite', {
          entityType: 'album',
          entityId: album.id,
          name: albumData.name,
          image: albumData.cover_image,
          artist: albumData.artists?.join(', '),
        });
      }
      invalidateFavorites();
    } catch (error) {
      setIsFavorite(!nextFavorite);
      console.error('Error al actualizar favorito:', error);
      showToast('No se pudieron actualizar los favoritos.');
    }
  };

  const formatDuration = (durationMs) => {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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

  // Función para publicar un nuevo comentario
  const handlePostComment = async () => {
    if (newComment.trim().length === 0) {
      showToast("El comentario no puede estar vacío.");
      return;
    }

    try {
      const response = await axiosInstance.post(`/album/${album.id}/comments`, {
        comment_text: newComment,
        name: albumData?.name,
        image: albumData?.cover_image,
        artist: albumData?.artists?.join(', '),
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

  if (!albumData) {
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
          {/* Fondo difuminado con la imagen del álbum */}
          <View style={styles.backgroundGlow}>
            {loadingAlbumImage && (
              <ActivityIndicator size="large" color="#A071CA" style={styles.albumImageLoader} />
            )}
            <Image 
              source={{ uri: albumData.cover_image || 'https://via.placeholder.com/500' }}  
              style={styles.blurredBackground}
              blurRadius={50}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={220}
              placeholder={require('../assets/default_picture.png')}
              onLoadStart={() => setLoadingAlbumImage(true)}
              onLoadEnd={() => setLoadingAlbumImage(false)}
            />
          </View>

          {/* Botón de cierre */}
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Icon name="times" size={30} color="#FFF" />
          </TouchableOpacity>

          {/* Imagen del álbum con efecto de escala */}
          <Animated.View style={[
            styles.albumImageContainer,
            { height: screenHeight * 0.5, transform: [{ scale: imageScale }] }
          ]}>
            {loadingAlbumImage && (
              <ActivityIndicator size="large" color="#A071CA" style={styles.albumImageLoader} />
            )}
            <Image 
              source={{ uri: albumData.cover_image || 'https://via.placeholder.com/500' }}  
              style={styles.albumImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={220}
              placeholder={require('../assets/default_picture.png')}
              onLoadStart={() => setLoadingAlbumImage(true)}
              onLoadEnd={() => setLoadingAlbumImage(false)}
            />
          </Animated.View>

          <View style={styles.contentContainer}>
            {/* Detalles del álbum */}
            <View style={styles.headerContainer}>
              <Text style={styles.albumName}>{albumData.name}</Text>
              <FavoriteButton isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
            </View>
            <TouchableOpacity
              onPress={() => {
                if (albumData.artist_ids && albumData.artist_ids.length > 0) {
                  navigation.navigate('ArtistDetailsScreen', {
                    artistId: albumData.artist_ids[0],
                    artistName: albumData.artists[0],
                  });
                } else {
                  console.warn('No se encontró artist_ids en albumData');
                  Alert.alert('Error', 'No se pudo obtener la información del artista.');
                }
              }}
            >
              <Text style={styles.albumArtists}>by {albumData.artists.join(', ')}</Text>
            </TouchableOpacity>
            <Text style={styles.albumReleaseDate}>Released on {albumData.release_date}</Text>

            {/* Sección de calificaciones */}
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>
                {userRating > 0 ? 'Tu calificación' : 'Califica este álbum'}
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

            {/* Lista de canciones */}
            <Text style={styles.tracksTitle}>Tracks</Text>
            <View style={styles.tracksContainer}>
              {albumData.tracks.map((track) => (
                <TouchableOpacity 
                  key={track.id} 
                  style={styles.trackItem}
                  onPress={() => {
                    navigation.navigate('SongDetailsScreen', { songId: track.id });
                  }}
                >
                  <Text style={styles.trackName}>{track.track_number}. {track.name}</Text>
                  <Text style={styles.trackDuration}>{formatDuration(track.duration_ms)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sección de comentarios */}
            <CommentSection
              entityType="album"
              entityId={albumData.id}
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
};

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
  albumImageLoader: { 
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
    zIndex: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  albumImageContainer: { 
    width: '100%',
    marginTop: -50,
  },
  albumImage: { 
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
  albumName: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 5,
    flex: 1,
    flexWrap: 'wrap',
  },
  albumArtists: {
    fontSize: 18,
    color: '#A071CA',
    marginBottom: 5,
  },
  albumReleaseDate: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 20,
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
  tracksTitle: {
    fontSize: 22,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tracksContainer: {
    marginBottom: 20,
  },
  trackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomColor: '#555',
    borderBottomWidth: 0.5,
    width: '100%', 
  },
  trackName: {
    fontSize: 16,
    color: '#FFF',
    flex: 1,
    flexWrap: 'wrap',
    marginRight: 10,
  },
  trackDuration: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end', 
    borderTopWidth: 1,
    borderColor: '#444',
    paddingTop: 10,          
    marginTop: 15,           
    paddingHorizontal: 10,  
    width: '100%',          
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

export default AlbumDetailsScreen;
