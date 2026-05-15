import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Animated,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CommentSection from '../components/CommentSection';
import SpinningDisc from '../components/SpinningDisc';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { SkeletonCard, SkeletonList } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { getUserId, normalizeComment, splitFavorites, resolveImageUrl } from '../utils/normalizers';
import { useToast } from '../context/ToastContext';
import { shareViewCapture } from '../utils/shareCapture';

export default function ProfileScreen({ navigation }) {
  const { user, isLoading, axiosInstance, logout, setUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isFocused = useIsFocused();
  const [comments, setComments] = useState([]);
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || '');

  const [newComment, setNewComment] = useState('');
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  const entityType = "profile";
  const entityId = getUserId(user);
  const commentsQueryKey = useMemo(() => queryKeys.comments(entityType, entityId), [entityId]);
  const followingIds = useMemo(() => user?.following || [], [user?.following]);
  const profileImageSource = useMemo(() => {
    const resolved = resolveImageUrl(user?.profile_picture);
    return resolved ? { uri: resolved } : require('../assets/default_picture.png');
  }, [user?.profile_picture]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const profileCaptureRef = useRef(null);

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

  const {
    data: favorites = [],
    isLoading: isLoadingFavorites,
  } = useQuery({
    queryKey: queryKeys.favorites,
    enabled: Boolean(user && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/get_favorites');
      return response.data.favorites || [];
    },
  });

  const { data: currentlyPlaying } = useSpotifyPlayback({ enabled: isFocused });

  const {
    data: followingUsers = [],
    isLoading: isLoadingFollowing,
  } = useQuery({
    queryKey: queryKeys.followingDetails(followingIds),
    enabled: Boolean(axiosInstance && followingIds.length > 0),
    queryFn: async () => {
      const response = await axiosInstance.post('/get_following_details', { ids: followingIds });
      return response.data.users || [];
    },
  });

  const { albums: favoriteAlbums, songs: favoriteSongs, artists: favoriteArtists } = useMemo(
    () => splitFavorites(favorites),
    [favorites]
  );

  const handleShareProfile = useCallback(async () => {
    try {
      await shareViewCapture(profileCaptureRef, `songbox-profile-${user?.username || 'user'}`);
    } catch (_error) {
      showToast('No se pudo compartir la captura del perfil.');
    }
  }, [showToast, user?.username]);

  const handleOpenCurrentTrack = useCallback(async () => {
    const url = currentlyPlaying?.item?.url;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (_error) {
      showToast('No se pudo abrir Spotify.');
    }
  }, [currentlyPlaying?.item?.url, showToast]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      showToast('El nombre de usuario no puede estar vacío.');
      return;
    }

    try {
      const response = await axiosInstance.post('/update_username', { username: newUsername });
      setUser({ ...user, username: response.data.username });
      showToast('Tu nombre de usuario ha sido actualizado.');
      setIsEditingUsername(false);
    } catch (error) {
      console.error('Error al actualizar el nombre de usuario:', error);
      showToast('No se pudo actualizar tu nombre de usuario.');
    }
  };

  const handlePickProfilePicture = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showToast('Se necesita permiso para acceder a la galería.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      setIsUploadingPicture(true);

      const formData = new FormData();
      formData.append('profile_picture', {
        uri: asset.uri,
        name: 'profile_picture.jpg',
        type: 'image/jpeg',
      });

      const response = await axiosInstance.post('/update_profile_picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUser({ ...user, profile_picture: response.data.profile_picture });
      showToast('Foto de perfil actualizada.');
    } catch (error) {
      console.error('Error al subir foto de perfil:', error);
      showToast('No se pudo actualizar la foto de perfil.');
    } finally {
      setIsUploadingPicture(false);
    }
  }, [axiosInstance, showToast, setUser, user]);

  const postCommentMutation = useMutation({
    mutationFn: (commentText) => axiosInstance.post(`/profile/${entityId}/comments`, {
      comment_text: commentText,
    }),
    onMutate: async (commentText) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previousComments = queryClient.getQueryData(commentsQueryKey);
      const optimisticComment = normalizeComment({
        _id: `optimistic-${Date.now()}`,
        username: user?.username || 'You',
        user_id: user?.id,
        comment_text: commentText,
        timestamp: new Date().toISOString(),
        likes: 0,
        dislikes: 0,
        liked_by: [],
        disliked_by: [],
      });

      queryClient.setQueryData(commentsQueryKey, (current) => {
        if (!current?.pages) {
          return {
            pages: [{ comments: [optimisticComment], pagination: { page: 1, total_pages: 1 } }],
            pageParams: [1],
          };
        }

        const [firstPage, ...restPages] = current.pages;
        return {
          ...current,
          pages: [
            { ...firstPage, comments: [optimisticComment, ...(firstPage.comments || [])] },
            ...restPages,
          ],
        };
      });

      setNewComment('');
      return { previousComments };
    },
    onSuccess: (response) => {
      const savedComment = normalizeComment(response.data.comment);
      queryClient.setQueryData(commentsQueryKey, (current) => {
        if (!current?.pages) return current;

        return {
          ...current,
          pages: current.pages.map((page, pageIndex) => ({
            ...page,
            comments: page.comments.map((comment, commentIndex) => (
              pageIndex === 0 && commentIndex === 0 && String(comment._id).startsWith('optimistic-')
                ? savedComment
                : comment
            )),
          })),
        };
      });
    },
    onError: (_error, _commentText, context) => {
      queryClient.setQueryData(commentsQueryKey, context?.previousComments);
      showToast('No se pudo agregar el comentario.');
    },
  });

  const handlePostComment = async () => {
    if (newComment.trim().length === 0) {
      showToast("El comentario no puede estar vacío.");
      return;
    }

    if (!entityId) {
      showToast("No se pudo identificar tu perfil.");
      return;
    }

    postCommentMutation.mutate(newComment.trim());
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
          <TouchableOpacity style={styles.profileImageContainer} onPress={handlePickProfilePicture} disabled={isUploadingPicture}>
            <Image 
              source={profileImageSource} 
              style={styles.profileImage}
            />
            {isUploadingPicture ? (
              <View style={styles.editIconContainer}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <View style={styles.editIconContainer}>
                <Icon name="pencil" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditingUsername(true)}>
            <Text style={styles.userName}>{user?.username || ''}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.profileShareButton} onPress={handleShareProfile} activeOpacity={0.86}>
        <Icon name="camera" size={15} color="#171515" />
        <Text style={styles.profileShareText}>Share Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.wrappedButton}
        onPress={() => navigation.navigate('WrappedScreen')}
        activeOpacity={0.86}
      >
        <View>
          <Text style={styles.wrappedEyebrow}>Monthly Wrapped</Text>
          <Text style={styles.wrappedTitle}>Your Month in Music</Text>
        </View>
        <View style={styles.wrappedIcon}>
          <Icon name="bar-chart" size={17} color="#171515" />
        </View>
      </TouchableOpacity>

      <FavoriteCarouselSection
        title="My Favorite Albums"
        titleStyle={styles.albumsTitle}
        data={favoriteAlbums}
        isLoading={isLoadingFavorites}
        renderItem={renderAlbumItem}
      />

      <FavoriteCarouselSection
        title="My Favorite Artists"
        titleStyle={styles.artistsTitle}
        data={favoriteArtists}
        isLoading={isLoadingFavorites}
        renderItem={renderArtistItem}
      />

      <Text style={styles.songsTitle}>My Favorite Songs</Text>      
    </>
  ), [favoriteAlbums, favoriteArtists, isLoadingFavorites, profileImageSource, renderAlbumItem, renderArtistItem, setIsEditingUsername, user?.username, handlePickProfilePicture, isUploadingPicture, navigation, handleShareProfile]);

  const followingSection = useMemo(() => (
    <FollowingSection
      followingCount={followingIds.length}
      followingUsers={followingUsers}
      isLoading={isLoadingFollowing}
      renderItem={renderFollowingItem}
    />
  ), [followingIds.length, followingUsers, isLoadingFollowing, renderFollowingItem]);

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
        <View ref={profileCaptureRef} collapsable={false} style={styles.profileShareCaptureWrap}>
          <ProfileShareCard
            username={user?.username || 'SongBox listener'}
            profileImageSource={profileImageSource}
            favoriteAlbums={favoriteAlbums.length}
            favoriteArtists={favoriteArtists.length}
            favoriteSongs={favoriteSongs.length}
            following={followingIds.length}
          />
        </View>
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
          <View style={styles.stickyNameWrap}>
            <Text style={styles.stickyUserName}>{user?.username || ''}</Text>
          </View>
          {currentlyPlaying?.is_playing && currentlyPlaying?.item?.cover_image && (
            <TouchableOpacity onPress={handleOpenCurrentTrack} activeOpacity={0.8}>
              <SpinningDisc
                source={{ uri: currentlyPlaying.item.cover_image }}
                size={36}
                isPlaying={true}
              />
            </TouchableOpacity>
          )}
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
                <TouchableOpacity style={styles.postButton} onPress={handlePostComment} disabled={postCommentMutation.isPending}>
                  <Text style={styles.postButtonText}>{postCommentMutation.isPending ? 'Publicando...' : 'Publicar'}</Text>
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

const FavoriteCarouselSection = React.memo(function FavoriteCarouselSection({ title, titleStyle, data, isLoading, renderItem }) {
  return (
    <>
      <Text style={titleStyle}>{title}</Text>
      {isLoading ? (
        <ProfileCarouselSkeleton />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.entityId}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          snapToAlignment="center"
          snapToInterval={180}
          decelerationRate="fast"
        />
      )}
    </>
  );
});

const FollowingSection = React.memo(function FollowingSection({ followingCount, followingUsers, isLoading, renderItem }) {
  return (
    <>
      <Text style={styles.followingTitle}>People I Follow</Text>
      {isLoading ? (
        <SkeletonList count={2} itemStyle={styles.followingSkeletonItem} />
      ) : followingCount === 0 ? (
        <Text style={styles.noFollowingText}>You are not following anyone.</Text>
      ) : (
        <FlatList
          data={followingUsers}
          renderItem={renderItem}
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
  );
});

const ProfileShareCard = React.memo(function ProfileShareCard({
  username,
  profileImageSource,
  favoriteAlbums,
  favoriteArtists,
  favoriteSongs,
  following,
}) {
  return (
    <View style={styles.profileShareCard}>
      <View style={styles.profileShareAura} />
      <Text style={styles.profileShareKicker}>SongBox Profile</Text>
      <View style={styles.profileShareIdentity}>
        <Image source={profileImageSource} style={styles.profileShareImage} contentFit="cover" />
        <View style={styles.profileShareNameBlock}>
          <Text style={styles.profileShareName} numberOfLines={1}>{username}</Text>
          <Text style={styles.profileShareSubtitle}>music taste archive</Text>
        </View>
      </View>
      <View style={styles.profileShareStats}>
        <ProfileShareStat label="Albums" value={favoriteAlbums} />
        <ProfileShareStat label="Artists" value={favoriteArtists} />
        <ProfileShareStat label="Songs" value={favoriteSongs} />
        <ProfileShareStat label="Following" value={following} />
      </View>
      <View style={styles.profileShareFooter}>
        <Text style={styles.profileShareFooterText}>Made with SongBox</Text>
        <View style={styles.profileShareMark} />
      </View>
    </View>
  );
});

const ProfileShareStat = ({ label, value }) => (
  <View style={styles.profileShareStat}>
    <Text style={styles.profileShareStatValue}>{value}</Text>
    <Text style={styles.profileShareStatLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  profileShareCaptureWrap: {
    position: 'absolute',
    left: -5000,
    top: 0,
    width: 360,
    zIndex: -1,
  },
  profileShareCard: {
    width: 360,
    minHeight: 520,
    padding: 24,
    borderRadius: 36,
    backgroundColor: '#201B27',
    overflow: 'hidden',
  },
  profileShareAura: {
    position: 'absolute',
    right: -72,
    top: -72,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(244,231,197,0.22)',
  },
  profileShareKicker: {
    color: '#F4E7C5',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  profileShareIdentity: {
    alignItems: 'center',
    marginTop: 36,
  },
  profileShareImage: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: 'rgba(244,231,197,0.65)',
  },
  profileShareNameBlock: {
    alignItems: 'center',
    marginTop: 18,
  },
  profileShareName: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    maxWidth: 290,
  },
  profileShareSubtitle: {
    color: '#BBA7FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  profileShareStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 34,
  },
  profileShareStat: {
    width: '48%',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileShareStatValue: {
    color: '#FFD166',
    fontSize: 26,
    fontWeight: '900',
  },
  profileShareStatLabel: {
    color: '#D8D0E4',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  profileShareFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 36,
  },
  profileShareFooterText: {
    color: '#766E81',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  profileShareMark: {
    width: 34,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F4E7C5',
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
  profileShareButton: {
    alignSelf: 'center',
    marginTop: -20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#F4E7C5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 9,
    elevation: 5,
  },
  profileShareText: {
    color: '#171515',
    fontSize: 12,
    fontWeight: '900',
  },
  wrappedButton: {
    marginHorizontal: 15,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: '#F4E7C5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  wrappedEyebrow: {
    color: '#5F4F31',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  wrappedTitle: {
    color: '#171515',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  wrappedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD166',
    alignItems: 'center',
    justifyContent: 'center',
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
  stickyNameWrap: {
    flex: 1,
    justifyContent: 'center',
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
