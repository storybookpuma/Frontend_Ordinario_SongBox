// ArtistDetailsScreen.js

import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  Animated,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import LoadingScreen from '../components/LoadingScreen';
import { AuthContext } from '../context/AuthContext';
import CommentSection from '../components/CommentSection';
import FavoriteButton from '../components/FavoriteButton';
import StarRating from '../components/StarRating'; 

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ArtistDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { axiosInstance, user } = useContext(AuthContext);

  const { artistId: routeArtistId, artist: routeArtist } = route.params;
  const artistId = routeArtistId || (routeArtist && routeArtist.id);

  const [artistData, setArtistData] = useState(null);
  const [loadingArtistImage, setLoadingArtistImage] = useState(true);
  const [loadingAlbumImages, setLoadingAlbumImages] = useState([]);
  const [comments, setComments] = useState([]);

  const [isFavorite, setIsFavorite] = useState(false);

  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  // Estado para el nuevo comentario
  const [newComment, setNewComment] = useState('');

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.5, 1],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp'
  });

  const renderAlbumCard = (album, index) => (
    <TouchableOpacity
      key={index}
      style={styles.albumCard}
      onPress={() => {
        navigation.navigate('AlbumDetailsScreen', {
          album: { id: album.id },
        });
      }}
    >
      {loadingAlbumImages[index] && (
        <ActivityIndicator size="small" color="#A071CA" style={styles.albumImageLoader} />
      )}
      <Image 
        source={{ uri: album.image || 'https://via.placeholder.com/150' }}
        style={styles.albumImage}
        onLoadStart={() => {
          let newLoadingState = [...loadingAlbumImages];
          newLoadingState[index] = true;
          setLoadingAlbumImages(newLoadingState);
        }}
        onLoadEnd={() => {
          let newLoadingState = [...loadingAlbumImages];
          newLoadingState[index] = false;
          setLoadingAlbumImages(newLoadingState);
        }}
      />
      <Text style={styles.albumTitle}>{album.title}</Text>
      <Text style={styles.albumReleaseDate}>{album.release_date}</Text>
    </TouchableOpacity>
  );

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artistId) {
        Alert.alert("Error", "No se proporcionó el ID del artista.");
        return;
      }

      try {
        const response = await axiosInstance.get(`/artist_details`, {
          params: {
            artist_id: artistId,
            cacheBust: new Date().getTime(),
          },
        });

        console.log('Respuesta del backend:', response.data); 
        setArtistData(response.data);

        setLoadingAlbumImages(new Array(response.data.albums.length).fill(true));

        setAverageRating(response.data.artist.averageRating || 0);
        setRatingCount(response.data.artist.ratingCount || 0);
      } catch (error) {
        console.error("Error al cargar los datos del artista:", error);
        Alert.alert("Error", "Hubo un problema al cargar los datos del artista. Por favor, intenta nuevamente.");
      }
    };

    fetchArtistData();
  }, [artistId, axiosInstance]);

  useEffect(() => {
    const checkIfFavorite = async () => {
      try {
        const response = await axiosInstance.get('/get_favorites');
        const favorites = response.data.favorites;
        const isFav = favorites.some(
          (fav) => fav.entityId === artistId && fav.entityType === 'artist'
        );
        setIsFavorite(isFav);
      } catch (error) {
        console.error('Error al verificar si es favorito:', error);
      }
    };

    if (artistData) {
      checkIfFavorite();
    }
  }, [artistData, artistId, axiosInstance]);

  useEffect(() => {
    const fetchUserRating = async () => {
      if (!artistData || !artistData.artist || !artistData.artist.id) return;
      try {
        const response = await axiosInstance.get('/get_user_rating', {
          params: {
            entityType: 'artist',
            entityId: artistData.artist.id,
          },
        });
        if (response.data.rating) {
          setUserRating(response.data.rating);
        }
      } catch (error) {
        console.error('Error al obtener la calificación del usuario:', error);
      }
    };

    if (artistData) {
      fetchUserRating();
    }
  }, [artistData, axiosInstance]);

  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        await axiosInstance.post('/remove_favorite', {
          entityId: artistId,
        });
      } else {
        await axiosInstance.post('/add_favorite', {
          entityType: 'artist',
          entityId: artistId,
          name: artistData.artist.name,
          image: artistData.artist.image,
        });
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error al actualizar favorito:', error);
      Alert.alert('Error', 'Hubo un problema al actualizar los favoritos.');
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
        entityType: 'artist',
        entityId: artistData.artist.id,
        rating: rating,
      });

      Alert.alert('Éxito', 'Tu calificación ha sido registrada.');
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

  const sortComments = (commentsList) => {
    return [...commentsList].sort((a, b) => b.likes - a.likes);
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

      const response = await axiosInstance.post(`/artist/${artistData.artist.id}/comments`, {
        comment_text: newComment,
      });

      console.log("Comentario agregado:", response.data.comment);

      const updatedComments = sortComments([response.data.comment, ...comments]);
      setComments(updatedComments);
      setNewComment('');
    } catch (error) {
      console.error("Error al agregar el comentario:", error.message);
      Alert.alert("Error", "No se pudo agregar el comentario. Verifica la conexión.");
    }
  };

  if (!artistData) {
    return <LoadingScreen />;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <>
          <View style={styles.backgroundGlow}>
            {loadingArtistImage && (
              <ActivityIndicator size="large" color="#A071CA" style={styles.artistImageLoader} />
            )}
            <Image 
              source={{ uri: artistData.artist.image || 'https://via.placeholder.com/500' }}  
              style={styles.blurredBackground}
              blurRadius={50}
              onLoadStart={() => setLoadingArtistImage(true)}
              onLoadEnd={() => setLoadingArtistImage(false)}
            />
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Icon name="times" size={30} color="#FFF" />
          </TouchableOpacity>

          <Animated.ScrollView 
            style={styles.scrollContainer}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps='handled'
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
          >
            <Animated.View style={[
              styles.artistImageContainer,
              { transform: [{ scale: imageScale }] }
            ]}>
              {loadingArtistImage && (
                <ActivityIndicator size="large" color="#A071CA" style={styles.artistImageLoader} />
              )}
              <Image 
                source={{ uri: artistData.artist.image || 'https://via.placeholder.com/500' }}  
                style={styles.artistImage}
                onLoadStart={() => setLoadingArtistImage(true)}
                onLoadEnd={() => setLoadingArtistImage(false)}
              />
            </Animated.View>

            <View style={styles.contentContainer}>
              <View style={styles.headerContainer}>
                <Text style={styles.artistName}>{artistData.artist.name}</Text>
                <FavoriteButton isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
              </View>

              <View style={styles.artistInfoContainer}>
                <Text style={styles.artistInfo}>
                  Popularity: {artistData.artist.popularity}%
                </Text>
                <Text style={styles.artistInfo}>
                  Followers: {artistData.artist.followers.toLocaleString()}
                </Text>
                <Text style={styles.artistInfo}>
                  Genres: {artistData.artist.genres.join(', ')}
                </Text>
              </View>

              {/* Sección de calificación */}
              <View style={styles.ratingSection}>
                <Text style={styles.ratingTitle}>Califica este artista</Text>
                <StarRating 
                  maxStars={10} 
                  currentRating={userRating} 
                  onRatingChange={handleRatingChange} 
                  editable={userRating === 0}
                />
                <Text style={styles.ratingInfo}>
                  Promedio: {averageRating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? 'calificación' : 'calificaciones'})
                </Text>
              </View>

              <Text style={styles.albumsListTitle}>Albums</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.albumsScrollView}
              >
                {artistData.albums?.map((album, index) => renderAlbumCard(album, index))}
              </ScrollView>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.followButton}>
                  <Text style={styles.followButtonText}>Follow Artist</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareButton}>
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>

              <CommentSection
                entityType="artist"
                entityId={artistData.artist.id}
                comments={comments}
                onAddComment={setComments}
                navigation={navigation}
              />

              {/* Campo de entrada para nuevos comentarios */}
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
          </Animated.ScrollView>
        </>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
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
  artistImageLoader: {
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
  scrollContainer: {
    flex: 1,
  },
  artistImageContainer: {
    height: screenHeight * 0.5,
    width: '100%',
    marginTop: -50,
  },
  artistImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 30,
    backgroundColor: 'rgba(23, 21, 21, 0.9)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  artistName: {
    fontSize: 30,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 10,
    flex: 1,
    flexWrap: 'wrap',
  },
  artistInfoContainer: {
    marginBottom: 20,
  },
  artistInfo: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 5,
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingTitle: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  ratingInfo: {
    fontSize: 16,
    color: '#FFF',
    marginTop: 10,
    opacity: 0.8,
  },
  albumsListTitle: {
    fontSize: 22,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  albumsScrollView: {
    marginBottom: 30,
  },
  albumCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 10,
    marginRight: 15,
    width: screenWidth * 0.5,
    alignItems: 'center',
  },
  albumImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 10,
  },
  albumImageLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -10,
    marginLeft: -10,
    zIndex: 2,
  },
  albumTitle: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  albumReleaseDate: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.6,
    textAlign: 'center',
  },
  actionButtons: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  followButton: {
    backgroundColor: '#A071CA',
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 30,
    width: '45%',
  },
  followButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButton: {
    backgroundColor: 'rgba(136, 136, 136, 0.5)',
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 30,
    width: '45%',
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderColor: '#444',
    paddingTop: 10,
    marginTop: 15,
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
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ArtistDetailsScreen;
