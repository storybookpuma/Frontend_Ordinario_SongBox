import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
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
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import LoadingScreen from '../components/LoadingScreen';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating';
import { AuthContext } from '../context/AuthContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'; 

export default function SongDetailsScreen({ route }) {
  const navigation = useNavigation();
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

  useEffect(() => {
    if (!songId) {
      Alert.alert('Error', 'No se proporcionó el ID de la canción.');
      navigation.goBack();
    }
  }, [navigation, songId]);

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.5, 1],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp'
  });

  useEffect(() => {
    const fetchSongData = async () => {
      if (!songId) return;

      try {
        const response = await axiosInstance.get('/song_details', {
          params: {
            song_id: songId,
            cacheBust: new Date().getTime()
          },
        });

        setSongData(response.data.song);
        setAverageRating(response.data.song.averageRating || 0);
        setRatingCount(response.data.song.ratingCount || 0);
      } catch (error) {
        console.error('Error fetching song details:', error);
        Alert.alert('Error', 'Hubo un problema al cargar los detalles de la canción. Por favor, intenta nuevamente.');
      }
    };

    fetchSongData();
  }, [songId, axiosInstance]);

  useEffect(() => {
    const checkIfFavorite = async () => {
      try {
        const response = await axiosInstance.get('/get_favorites');
        const favorites = response.data.favorites;
        const isFav = favorites.some(
          (fav) => fav.entityId === songId && fav.entityType === 'song'
        );
        setIsFavorite(isFav);
      } catch (error) {
        console.error('Error al verificar si es favorito:', error);
      }
    };

    if (songData) {
      checkIfFavorite();
    }
  }, [songData, axiosInstance, songId]);

  useEffect(() => {
    const fetchUserRating = async () => {
      try {
        const response = await axiosInstance.get('/get_user_rating', {
          params: {
            entityType: 'song',
            entityId: songId,
          },
        });

        if (response.data.rating) {
          setUserRating(response.data.rating);
        }
      } catch (error) {
        console.error('Error al obtener la calificación del usuario:', error);
      }
    };

    if (songData) {
      fetchUserRating();
    }
  }, [songData, axiosInstance, songId]);

  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
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
        });
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error al actualizar favorito:', error);
      Alert.alert('Error', 'Hubo un problema al actualizar los favoritos.');
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
  
    if (rating === 0) {
      Alert.alert('Acción no permitida', 'No puedes eliminar tu calificación una vez realizada.');
      return;
    }
  
    try {
      const response = await axiosInstance.post('/rate_entity', {
        entityType: 'song',        
        entityId: songId,          
        rating: rating,            
      });
  
      Alert.alert('Éxito', 'Tu calificación ha sido registrada.');
  
      // Actualizar el promedio y el conteo de calificaciones
      setAverageRating(response.data.averageRating);
      setRatingCount(response.data.ratingCount);
      setUserRating(rating);
    } catch (error) {
      if (error.response && error.response.data.message) {
        Alert.alert('Error', error.response.data.message);
      } else {
        console.error('Error al calificar:', error);
        Alert.alert('Error', 'No se pudo registrar tu calificación.');
      }
    }
  };
  

  const handlePostComment = async () => {
    if (newComment.trim().length === 0) {
      Alert.alert("Error", "El comentario no puede estar vacío.");
      return;
    }

    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      const response = await axiosInstance.post(`/song/${songId}/comments`, {
        comment_text: newComment,
      });

      const updatedComments = sortComments([response.data.comment, ...comments]);
      setComments(updatedComments); 
      setNewComment('');
    } catch (error) {
      console.error("Error al agregar el comentario:", error.message);
      Alert.alert("Error", "No se pudo agregar el comentario. Verifica la conexión.");
    }
  };

  const sortComments = (commentsList) => {
    return [...commentsList].sort((a, b) => b.likes - a.likes);
  };

  if (!songData) {
    return <LoadingScreen />;
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
                  console.warn('No se encontró artist_ids en songData');
                  Alert.alert('No se pudo obtener la información del artista.');
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
                  console.warn('No se encontró album_id en songData');
                  Alert.alert('No se pudo obtener la información del álbum.');
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
              <Text style={styles.sectionTitle}>Califica esta canción</Text>
              <StarRating 
                maxStars={10} 
                currentRating={userRating} 
                onRatingChange={handleRatingChange} 
                editable={userRating === 0} 
              />
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
    resizeMode: 'cover',
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
