import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MenuBar from '../components/MenuBar'; 
import CommentSection from '../components/CommentSection';
import { AuthContext } from '../context/AuthContext';

export default function UserDetailsScreen({ route, navigation }) {
  const { profileId } = route.params;
  const { axiosInstance, user, setUser } = useContext(AuthContext); 
  const [profileData, setProfileData] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  
  const entityId = profileId; 

  const scrollY = useRef(new Animated.Value(0)).current;

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState(null);

  // Determinar si el usuario actual sigue a este perfil
  const isFollowing = user && user.following && user.following.includes(profileId);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!axiosInstance || !profileId) {
        setError("No se pudo cargar el perfil.");
        setIsLoadingProfile(false);
        return;
      }

      try {
        const response = await axiosInstance.get('/profile_details', {
          params: { profile_id: profileId }
        });

        setProfileData(response.data);
        setFavorites(response.data.favorites || []);
      } catch (err) {
        console.error("Error al cargar el perfil:", err);
        Alert.alert('Error', 'No se pudo cargar el perfil del usuario.');
        setError('No se pudo cargar el perfil.');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfileData();
  }, [axiosInstance, profileId]);

  const favoriteAlbums = favorites.filter(fav => fav.entityType === 'album');
  const favoriteSongs = favorites.filter(fav => fav.entityType === 'song');
  const favoriteArtists = favorites.filter(fav => fav.entityType === 'artist');

  const handleAddComment = (updatedComments) => {
    setComments(updatedComments);
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

      const response = await axiosInstance.post(`/profile/${entityId}/comments`, {
        comment_text: newComment,
      });

      const updatedComments = [response.data.comment, ...comments];
      setComments(updatedComments);
      setNewComment('');
    } catch (error) {
      console.error("Error al agregar el comentario:", error.message);
      Alert.alert("Error", "No se pudo agregar el comentario. Verifica la conexión.");
    }
  };

  const handleFollow = async () => {
    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }
      
      const response = await axiosInstance.post('/follow_user', {
        profile_id: profileId
      });
      Alert.alert("Éxito", response.data.message);

      // Actualizar el estado del usuario logueado para reflejar que ahora sigue a este perfil
      if (user) {
        const updatedUser = { ...user };
        updatedUser.following = updatedUser.following || [];
        if (!updatedUser.following.includes(profileId)) {
          updatedUser.following.push(profileId);
        }
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Error al seguir al usuario:", err);
      Alert.alert("Error", "No se pudo seguir al usuario.");
    }
  };

  const handleUnfollow = async () => {
    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }
      
      const response = await axiosInstance.post('/unfollow_user', {
        profile_id: profileId
      });
      Alert.alert("Éxito", response.data.message);

      // Actualizar el estado del usuario logueado para reflejar que ya no sigue a este perfil
      if (user) {
        const updatedUser = { ...user };
        updatedUser.following = updatedUser.following || [];
        updatedUser.following = updatedUser.following.filter(id => id !== profileId);
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Error al dejar de seguir al usuario:", err);
      Alert.alert("Error", "No se pudo dejar de seguir al usuario.");
    }
  };

  if (isLoadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A071CA" />
      </View>
    );
  }

  if (error || !profileData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || "Error al cargar el perfil."}</Text>
      </View>
    );
  }

  // Mostrar botón de Follow/Unfollow solo si no es el perfil del usuario logueado
  const showFollowButton = user && profileData.id && (profileData.id !== user.id);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>

        <Animated.View style={[
          styles.stickyHeader,
          {
            opacity: scrollY.interpolate({
              inputRange: [100, 150],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
            transform: [{
              translateY: scrollY.interpolate({
                inputRange: [100, 150],
                outputRange: [-50, 0],
                extrapolate: 'clamp',
              })
            }]
          }
        ]}>
          <Image 
            source={require('../assets/default_picture.png')} 
            style={styles.stickyProfileImage}
          />
          <Text style={styles.stickyUserName}>{profileData.username || ''}</Text>
        </Animated.View>

        <Animated.FlatList
          ListHeaderComponent={
            <>
              <View style={styles.topRectangle}>
                <View style={styles.profileInfoContainer}>
                  <TouchableOpacity style={styles.profileImageContainer}>
                    <Image 
                      source={require('../assets/default_picture.png')} 
                      style={styles.profileImage}
                    />
                    <View style={styles.editIconContainer}>
                      <Icon name="pencil" size={20} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Text style={styles.userName}>{profileData.username || ''}</Text>
                  </TouchableOpacity>
                  {showFollowButton && (
                    <TouchableOpacity 
                      style={styles.followButton} 
                      onPress={isFollowing ? handleUnfollow : handleFollow}
                    >
                      <Text style={styles.followButtonText}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Álbumes favoritos */}
              <Text style={styles.albumsTitle}>User's Favorite Albums</Text>
              <View style={styles.sectionContainer}>
                {favoriteAlbums.length === 0 ? (
                  <Text style={styles.noDataText}>There is nothing to see</Text>
                ) : (
                  <FlatList
                    data={favoriteAlbums}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.carouselItem}
                        onPress={() => {
                          navigation.navigate('AlbumDetailsScreen', { album: { id: item.entityId } });
                        }}
                      >
                        <Image source={{ uri: item.image }} style={styles.albumImage} />
                        <Text style={styles.albumTitle}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.entityId}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContainer}
                    snapToAlignment="center"
                    snapToInterval={180}
                    decelerationRate="fast"
                  />
                )}
              </View>

              {/* Artistas favoritos */}
              <Text style={styles.artistsTitle}>User's Favorite Artists</Text>
              <View style={styles.sectionContainer}>
                {favoriteArtists.length === 0 ? (
                  <Text style={styles.noDataText}>There is nothing to see</Text>
                ) : (
                  <FlatList
                    data={favoriteArtists}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.carouselItem}
                        onPress={() => {
                          navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
                        }}
                      >
                        <Image source={{ uri: item.image }} style={styles.albumImage} />
                        <Text style={styles.albumTitle}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.entityId}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContainer}
                    snapToAlignment="center"
                    snapToInterval={180}
                    decelerationRate="fast"
                  />
                )}
              </View>

              {/* Canciones favoritas */}
              <Text style={styles.songsTitle}>User's Favorite Songs</Text>
              <View style={styles.sectionContainer}>
                {favoriteSongs.length === 0 ? (
                  <Text style={styles.noDataText}>There is nothing to see</Text>
                ) : (
                  <FlatList
                    data={favoriteSongs}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.songItem}
                        onPress={() => {
                          navigation.navigate('SongDetailsScreen', { songId: item.entityId });
                        }}
                      >
                        <Image source={{ uri: item.image }} style={styles.songImage} />
                        <View style={styles.songInfo}>
                          <Text style={styles.songTitle}>{item.name}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.entityId}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>

              {/* Sección de comentarios */}
              <CommentSection
                entityType="profile"
                entityId={entityId}
                comments={comments}
                onAddComment={handleAddComment}
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
            </>
          }
          data={[]} 
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        />

        {/* Barra de Menú Inferior */}
        <View style={styles.menuContainer}>
          <MenuBar />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  listContainer: {
    paddingBottom: 150, 
  },
  topRectangle: {
    width: '100%',
    height: 228,
    backgroundColor: '#35323285', 
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingTop: 55, 
    zIndex: 1,  
  },
  profileInfoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60, 
    marginBottom: 10,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    padding: 5,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  followButton: {
    backgroundColor: '#A071CA',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  albumsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
    marginLeft: 15
  },
  artistsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
    marginLeft: 15
  },
  songsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15, 
    marginLeft: 15
  },
  noDataText: {
    color: '#fff',
    marginLeft: 15,
    marginBottom: 15,
    fontSize: 16,
    opacity: 0.8,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  carouselContainer: {
    paddingLeft: 10,
    paddingRight: 10,
  },
  carouselItem: {
    alignItems: 'center',
    marginHorizontal: 10,  
    width: 160,
  },
  albumImage: {
    width: 200,
    height: 250,
    borderRadius: 10,
    marginBottom: -10,
  },
  albumTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 10,
  },
  songImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,  
  },
  stickyHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 21, 21, 0.9)',
    borderRadius: 25,
    paddingHorizontal: 10,
    zIndex: 1000,
    opacity: 0,
    transform: [{ translateY: -50 }],
  },
  stickyProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  stickyUserName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#171515',
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#171515',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
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
    backgroundColor: '#171515',
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
