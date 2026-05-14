import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import CommentSection from '../components/CommentSection';
import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { SkeletonCard, SkeletonList } from '../components/Skeleton';

export default function ProfileScreen({ navigation }) {
  const { user, isLoading, axiosInstance, logout, setUser } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]);
  const [comments, setComments] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]); // Nuevo estado para usuarios seguidos
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || '');

  const [newComment, setNewComment] = useState('');

  const entityType = "profile";
  const entityId = user && (user._id || user.id) ? (user._id || user.id).toString() : '';
  const profileImageSource = useMemo(() => (
    user?.profile_picture
      ? { uri: user.profile_picture }
      : require('../assets/default_picture.png')
  ), [user?.profile_picture]);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const refreshUser = async () => {
      if (!user || entityId || !axiosInstance) return;

      setIsRefreshingUser(true);
      try {
        const response = await axiosInstance.get('/me');
        setUser(response.data.user);
      } catch (error) {
        console.error('Error al refrescar el usuario:', error);
      } finally {
        setIsRefreshingUser(false);
      }
    };

    refreshUser();
  }, [axiosInstance, entityId, setUser, user]);

  useEffect(() => {
    if (!user) return;
    const fetchFavorites = async () => {
      if (!axiosInstance) {
        console.error('axiosInstance no está definido');
        return;
      }

      setIsLoadingFavorites(true);
      try {
        const response = await axiosInstance.get('/get_favorites');
        setFavorites(response.data.favorites);
      } catch (error) {
        if (error.response?.status === 401) return;
        console.error('Error al obtener favoritos:', error);
        Alert.alert('Error', 'Hubo un problema al obtener tus favoritos.');
      } finally {
        setIsLoadingFavorites(false);
      }
    };

    fetchFavorites();
  }, [axiosInstance, user]);

  // Efecto para obtener los datos de los usuarios seguidos
  useEffect(() => {
    const fetchFollowingUsers = async () => {
      if (!axiosInstance || !user?.following || user.following.length === 0) {
        setFollowingUsers([]);
        return;
      }

      setIsLoadingFollowing(true);
      try {
        const response = await axiosInstance.post('/get_following_details', {
          ids: user.following
        });
        setFollowingUsers(response.data.users || []);
      } catch (error) {
        if (error.response?.status === 401) return;
        console.error('Error al obtener usuarios seguidos:', error);
      } finally {
        setIsLoadingFollowing(false);
      }
    };
    
    if (user && user.following) {
      fetchFollowingUsers();
    }
  }, [axiosInstance, user]);

  const favoriteAlbums = useMemo(() => favorites.filter(fav => fav.entityType === 'album'), [favorites]);
  const favoriteSongs = useMemo(() => favorites.filter(fav => fav.entityType === 'song'), [favorites]);
  const favoriteArtists = useMemo(() => favorites.filter(fav => fav.entityType === 'artist'), [favorites]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      Alert.alert('Error', 'El nombre de usuario no puede estar vacío.');
      return;
    }

    try {
      const response = await axiosInstance.post('/update_username', { username: newUsername });
      setUser({ ...user, username: response.data.username });
      Alert.alert('Éxito', 'Tu nombre de usuario ha sido actualizado.');
      setIsEditingUsername(false);
    } catch (error) {
      console.error('Error al actualizar el nombre de usuario:', error);
      Alert.alert('Error', 'No se pudo actualizar tu nombre de usuario.');
    }
  };

  const handlePostComment = async () => {
    if (newComment.trim().length === 0) {
      Alert.alert("Error", "El comentario no puede estar vacío.");
      return;
    }

    if (!entityId) {
      Alert.alert("Error", "No se pudo identificar tu perfil. Intenta iniciar sesión nuevamente.");
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

  const handleAddComment = useCallback((updatedComments) => {
    setComments(updatedComments);
  }, []);

  const renderAlbumItem = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.carouselItem}
      onPress={() => {
        navigation.navigate('AlbumDetailsScreen', { album: { id: item.entityId } });
      }}
    >
      <Image source={{ uri: item.image }} style={styles.albumImage} />
      <Text style={styles.albumTitle}>{item.name}</Text>
    </TouchableOpacity>
  ), [navigation]);

  const renderSongItem = useCallback(({ item }) => (
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
  ), [navigation]);

  const renderArtistItem = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.carouselItem}
      onPress={() => {
        navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
      }}
    >
      <Image source={{ uri: item.image }} style={styles.albumImage} />
      <Text style={styles.albumTitle}>{item.name}</Text>
    </TouchableOpacity>
  ), [navigation]);

  const renderFollowingItem = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.followingItem}
      onPress={() => {
        navigation.navigate('UserDetailsScreen', { profileId: item.id });
      }}
    >
      <Image 
        source={ item.profile_picture ? { uri: item.profile_picture } : require('../assets/default_picture.png')}
        style={styles.followingUserImage}
      />
      <Text style={styles.followingUserName}>{item.username}</Text>
    </TouchableOpacity>
  ), [navigation]);

  const listHeader = useMemo(() => (
    <>
      <View style={styles.topRectangle}>
        <View style={styles.profileInfoContainer}>
          <TouchableOpacity style={styles.profileImageContainer}>
            <Image 
              source={profileImageSource} 
              style={styles.profileImage}
            />
            <View style={styles.editIconContainer}>
              <Icon name="pencil" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditingUsername(true)}>
            <Text style={styles.userName}>{user?.username || ''}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Secciones de favoritos */}
      <Text style={styles.albumsTitle}>My Favorite Albums</Text>
      {isLoadingFavorites ? (
        <ProfileCarouselSkeleton />
      ) : (
        <FlatList
          data={favoriteAlbums}
          renderItem={renderAlbumItem}
          keyExtractor={(item) => item.entityId}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          snapToAlignment="center"
          snapToInterval={180}
          decelerationRate="fast"
        />
      )}

      <Text style={styles.artistsTitle}>My Favorite Artists</Text>
      {isLoadingFavorites ? (
        <ProfileCarouselSkeleton />
      ) : (
        <FlatList
          data={favoriteArtists}
          renderItem={renderArtistItem}
          keyExtractor={(item) => item.entityId}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          snapToAlignment="center"
          snapToInterval={180}
          decelerationRate="fast"
        />
      )}

      <Text style={styles.songsTitle}>My Favorite Songs</Text>      
    </>
  ), [favoriteAlbums, favoriteArtists, isLoadingFavorites, profileImageSource, renderAlbumItem, renderArtistItem, setIsEditingUsername, user?.username]);

  const followingSection = useMemo(() => (
    <>
      <Text style={styles.followingTitle}>People I Follow</Text>
      {isLoadingFollowing ? (
        <SkeletonList count={2} itemStyle={styles.followingSkeletonItem} />
      ) : (!user.following || user.following.length === 0) ? (
        <Text style={styles.noFollowingText}>You are not following anyone.</Text>
      ) : (
        <FlatList
          data={followingUsers}
          renderItem={renderFollowingItem}
          keyExtractor={(item) => item.id}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          snapToAlignment="center"
          snapToInterval={180}
          decelerationRate="fast"
        />
      )}
    </>
  ), [followingUsers, isLoadingFollowing, renderFollowingItem, user?.following]);

  if (isLoading || isRefreshingUser) {
    return <LoadingScreen />;
  }

  if (!user || !entityId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMessage}>Error al cargar el perfil. Por favor, inicia sesión nuevamente.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={logout}
        >
          <Icon name="sign-out" size={24} color="#fff" />
        </TouchableOpacity>

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
            source={profileImageSource} 
            style={styles.stickyProfileImage}
          />
          <Text style={styles.stickyUserName}>{user?.username || ''}</Text>
        </Animated.View>

        <Animated.FlatList
          ListHeaderComponent={listHeader}
          data={isLoadingFavorites ? [] : favoriteSongs}
          renderItem={renderSongItem}
          keyExtractor={(item) => item.entityId}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          ListFooterComponent={
            <>
              {isLoadingFavorites ? <SkeletonList count={3} itemStyle={styles.songSkeletonItem} /> : null}
              {followingSection}
              <CommentSection 
                entityType={entityType} 
                entityId={entityId} 
                comments={comments}
                onAddComment={handleAddComment}
                showLoadErrorAlert={false}
              />
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
        />
        <Modal
          transparent={true}
          animationType="slide"
          visible={isEditingUsername}
          onRequestClose={() => setIsEditingUsername(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Edit Username</Text>
              <TextInput
                style={styles.modalInput}
                value={newUsername}
                onChangeText={setNewUsername}
                placeholder="Enter new username"
                placeholderTextColor="#888"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setIsEditingUsername(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleSaveUsername}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
    </View>
  );
}

const ProfileCarouselSkeleton = () => (
  <View style={styles.profileSkeletonRow}>
    {Array.from({ length: 3 }).map((_, index) => (
      <SkeletonCard key={index} style={styles.profileSkeletonCard} imageStyle={styles.profileSkeletonImage} />
    ))}
  </View>
);

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
  followingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
    marginLeft: 15
  },
  noFollowingText: {
    color: '#fff',
    marginLeft: 15,
    marginBottom: 15,
    fontSize: 16,
    opacity: 0.8,
  },
  carouselContainer: {
    paddingLeft: 10,
    paddingRight: 10,
  },
  profileSkeletonRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  profileSkeletonCard: {
    width: 150,
  },
  profileSkeletonImage: {
    height: 170,
  },
  followingSkeletonItem: {
    marginHorizontal: 15,
    marginBottom: 10,
  },
  songSkeletonItem: {
    marginHorizontal: 15,
    marginBottom: 10,
  },
  carouselItem: {
    alignItems: 'center',
    marginHorizontal: 10,  
    width: 160,
  },
  followingItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 160,
  },
  followingUserImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 5,
  },
  followingUserName: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
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
  errorMessage: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  logoutButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#1c1c1c',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: '#A071CA',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
