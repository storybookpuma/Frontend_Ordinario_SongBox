import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Animated,
  Platform,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Image } from 'expo-image';
import MenuBar from '../components/MenuBar'; 
import CommentSection from '../components/CommentSection';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { resolveImageUrl, splitFavorites } from '../utils/normalizers';
import { getApiErrorMessage } from '../utils/errors';
import { useToast } from '../context/ToastContext';
import { useProfileCompatibility } from '../hooks/useProfileCompatibility';

export default function UserDetailsScreen({ route, navigation }) {
  const { profileId } = route.params;
  const { axiosInstance, user, setUser } = useContext(AuthContext); 
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [profileData, setProfileData] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  
  const entityId = profileId; 

  const scrollY = useRef(new Animated.Value(0)).current;

  const [error, setError] = useState(null);

  // Determinar si el usuario actual sigue a este perfil
  const isFollowing = user && user.following && user.following.includes(profileId);

  const profileQuery = useQuery({
    queryKey: queryKeys.profileDetails(profileId),
    enabled: Boolean(axiosInstance && profileId),
    queryFn: async () => {
      const response = await axiosInstance.get('/profile_details', {
        params: { profile_id: profileId },
      });
      return response.data;
    },
  });

  const { data: compatibility } = useProfileCompatibility(profileId);

  useEffect(() => {
    if (profileQuery.data) {
      setProfileData(profileQuery.data);
      setError(null);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (profileQuery.isError) {
      const message = getApiErrorMessage(profileQuery.error, 'No se pudo cargar el perfil.');
      setError(message);
      showToast(message);
    }
  }, [profileQuery.error, profileQuery.isError, showToast]);

  const profileImageSource = useMemo(() => {
    const resolved = resolveImageUrl(profileData?.profile_picture);
    return resolved ? { uri: resolved } : require('../assets/default_picture.png');
  }, [profileData?.profile_picture]);
  const { albums: favoriteAlbums, songs: favoriteSongs, artists: favoriteArtists } = splitFavorites(profileData?.favorites || []);

  const handleAddComment = (updatedComments) => {
    setComments(updatedComments);
  };

  const handlePostComment = async () => {
    if (newComment.trim().length === 0) {
      showToast("El comentario no puede estar vacío.");
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
      showToast("No se pudo agregar el comentario.");
    }
  };

  const followMutation = useMutation({
    mutationFn: (shouldFollow) => axiosInstance.post(shouldFollow ? '/follow_user' : '/unfollow_user', {
      profile_id: profileId,
    }),
    onMutate: async (shouldFollow) => {
      const previousUser = user;
      if (user) {
        const following = Array.isArray(user.following) ? user.following : [];
        setUser({
          ...user,
          following: shouldFollow
            ? Array.from(new Set([...following, profileId]))
            : following.filter((id) => id !== profileId),
        });
      }
      return { previousUser };
    },
    onSuccess: (response) => {
      showToast(response.data.message || 'Perfil actualizado.');
      queryClient.invalidateQueries({ queryKey: queryKeys.followingDetails(user?.following || []) });
    },
    onError: (err, _shouldFollow, context) => {
      if (context?.previousUser) setUser(context.previousUser);
      showToast(getApiErrorMessage(err, 'No se pudo actualizar el seguimiento.'));
    },
  });

  const handleFollow = () => followMutation.mutate(true);
  const handleUnfollow = () => followMutation.mutate(false);

  if (profileQuery.isLoading) {
    return <DetailSkeleton />;
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
            source={profileImageSource}
            style={styles.stickyProfileImage}
            contentFit="cover"
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
                      source={profileImageSource}
                      style={styles.profileImage}
                      contentFit="cover"
                    />
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

              <View style={styles.compatibilityCard}>
                <View>
                  <Text style={styles.compatibilityEyebrow}>Taste Match</Text>
                  <Text style={styles.compatibilityScore}>{compatibility?.score ?? 0}%</Text>
                </View>
                <View style={styles.compatibilityMeta}>
                  <Text style={styles.compatibilityText}>{compatibility?.sharedCount || 0} shared favorites</Text>
                  <Text style={styles.compatibilityText} numberOfLines={1}>
                    {compatibility?.topSharedArtists?.[0]?.name || 'Build overlap by saving more music'}
                  </Text>
                </View>
              </View>

              {compatibility?.sharedItems?.length ? (
                <View style={styles.sharedStrip}>
                  <Text style={styles.sharedTitle}>Shared favorites</Text>
                  <FlatList
                    data={compatibility.sharedItems}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => `${item.entityType}-${item.entityId}`}
                    contentContainerStyle={styles.sharedList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.sharedItem}
                        onPress={() => {
                          if (item.entityType === 'song') navigation.navigate('SongDetailsScreen', { songId: item.entityId });
                          if (item.entityType === 'album') navigation.navigate('AlbumDetailsScreen', { album: { id: item.entityId } });
                          if (item.entityType === 'artist') navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
                        }}
                      >
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={styles.sharedImage} contentFit="cover" cachePolicy="memory-disk" />
                        ) : (
                          <View style={styles.sharedImage} />
                        )}
                        <Text style={styles.sharedName} numberOfLines={1}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              ) : null}

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
                        <Image source={{ uri: item.image }} style={styles.albumImage} contentFit="cover" cachePolicy="memory-disk" transition={180} placeholder={require('../assets/default_picture.png')} />
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
                        <Image source={{ uri: item.image }} style={styles.albumImage} contentFit="cover" cachePolicy="memory-disk" transition={180} placeholder={require('../assets/default_picture.png')} />
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
                        <Image source={{ uri: item.image }} style={styles.songImage} contentFit="cover" cachePolicy="memory-disk" transition={180} placeholder={require('../assets/default_picture.png')} />
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
  compatibilityCard: {
    marginHorizontal: 15,
    marginTop: 18,
    padding: 18,
    borderRadius: 26,
    backgroundColor: '#F4E7C5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  compatibilityEyebrow: {
    color: '#5F4F31',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  compatibilityScore: {
    color: '#171515',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
  },
  compatibilityMeta: {
    flex: 1,
  },
  compatibilityText: {
    color: '#4D4129',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  sharedStrip: {
    marginTop: 18,
  },
  sharedTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 15,
    marginBottom: 10,
  },
  sharedList: {
    paddingHorizontal: 15,
    gap: 10,
  },
  sharedItem: {
    width: 94,
  },
  sharedImage: {
    width: 94,
    height: 94,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
  },
  sharedName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
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
