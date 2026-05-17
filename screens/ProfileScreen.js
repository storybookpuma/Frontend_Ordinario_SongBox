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
import { useQuery } from '@tanstack/react-query';
import SpinningDisc from '../components/SpinningDisc';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useBadges } from '../hooks/useBadges';
import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { SkeletonCard, SkeletonList } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { getUserId, splitFavorites, resolveImageUrl } from '../utils/normalizers';
import { useToast } from '../context/ToastContext';
import { shareViewCapture } from '../utils/shareCapture';

export default function ProfileScreen({ navigation }) {
  const { user, isLoading, axiosInstance, setUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const isFocused = useIsFocused();
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || '');

  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  const entityId = getUserId(user);
  const followingIds = useMemo(() => user?.following || [], [user?.following]);
  const profileImageSource = useMemo(() => {
    const resolved = resolveImageUrl(user?.profile_picture);
    return resolved ? { uri: resolved } : require('../assets/default_picture.png');
  }, [user?.profile_picture]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const profileCaptureRef = useRef(null);
  const top3CaptureRef = useRef(null);
  const spotifySyncStarted = useRef(false);

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
    queryKey: queryKeys.favorites(entityId),
    enabled: Boolean(entityId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/get_favorites');
      return response.data.favorites || [];
    },
  });

  const { data: currentlyPlaying } = useSpotifyPlayback({ enabled: isFocused });
  const { data: badges = [] } = useBadges();

  const {
    data: tasteWallData,
    refetch: refetchTasteWall,
  } = useQuery({
    queryKey: queryKeys.tasteWall(entityId),
    enabled: Boolean(entityId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/taste/wall');
      return response.data;
    },
  });

  useEffect(() => {
    if (!isFocused || !user?.spotify_connected || !axiosInstance || spotifySyncStarted.current) return;
    spotifySyncStarted.current = true;
    axiosInstance.post('/spotify/sync')
      .then(() => refetchTasteWall())
      .catch(() => {
        spotifySyncStarted.current = false;
      });
  }, [axiosInstance, isFocused, refetchTasteWall, user?.spotify_connected]);

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

  const top3Items = useMemo(() => {
    const all = [
      ...favoriteAlbums.map((i) => ({ ...i, typeLabel: 'Album' })),
      ...favoriteSongs.map((i) => ({ ...i, typeLabel: 'Song' })),
      ...favoriteArtists.map((i) => ({ ...i, typeLabel: 'Artist' })),
    ];
    return all.slice(0, 3);
  }, [favoriteAlbums, favoriteSongs, favoriteArtists]);

  const handleShareTop3 = useCallback(async () => {
    try {
      await shareViewCapture(top3CaptureRef, `songbox-top3-${user?.username || 'user'}`);
    } catch (_error) {
      showToast('No se pudo compartir el Top 3.');
    }
  }, [showToast, user?.username]);

  const tasteWall = useMemo(() => {
    const totalFavorites = favorites.length;
    const dominantType = [
      { label: 'Albums', value: favoriteAlbums.length },
      { label: 'Artists', value: favoriteArtists.length },
      { label: 'Songs', value: favoriteSongs.length },
    ].sort((a, b) => b.value - a.value)[0];
    const currentEra = dominantType?.value > 0 ? `${dominantType.label} era` : 'Building a taste archive';
    const recentFavorites = favorites.slice(0, 4);

    if (tasteWallData) {
      return {
        currentEra: tasteWallData.currentEra || currentEra,
        totalFavorites: tasteWallData.totalSignals || totalFavorites,
        dominantType: tasteWallData.dominantType || dominantType?.label || 'None yet',
        top3Items: tasteWallData.pinnedItems?.length ? tasteWallData.pinnedItems : top3Items,
        recentFavorites: tasteWallData.recentItems?.length ? tasteWallData.recentItems : recentFavorites,
        sourceCounts: tasteWallData.sourceCounts || {},
      };
    }

    return {
      currentEra,
      totalFavorites,
      dominantType: dominantType?.label || 'None yet',
      top3Items,
      recentFavorites,
      sourceCounts: {},
    };
  }, [favoriteAlbums.length, favoriteArtists.length, favoriteSongs.length, favorites, top3Items, tasteWallData]);

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
        {currentlyPlaying?.is_playing && currentlyPlaying?.item?.cover_image && (
          <Animated.Image
            source={{ uri: currentlyPlaying.item.cover_image }}
            style={[
              styles.topRectangleBg,
              {
                opacity: scrollY.interpolate({
                  inputRange: [0, 100, 150],
                  outputRange: [0.22, 0.22, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
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

      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.profileShareButton} onPress={handleShareProfile} activeOpacity={0.86}>
          <Icon name="camera" size={15} color="#171515" />
          <Text style={styles.profileShareText}>Share Profile</Text>
        </TouchableOpacity>
        {top3Items.length > 0 && (
          <TouchableOpacity style={styles.top3ShareButton} onPress={handleShareTop3} activeOpacity={0.86}>
            <Icon name="trophy" size={15} color="#171515" />
            <Text style={styles.profileShareText}>Share Top 3</Text>
          </TouchableOpacity>
        )}
      </View>

      <TasteWallSection data={tasteWall} navigation={navigation} />

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

      <BadgesSection badges={badges} />

      <TouchableOpacity
        style={styles.plusButton}
        onPress={() => navigation.navigate('PlusScreen')}
        activeOpacity={0.86}
      >
        <Icon name="star" size={15} color="#171515" />
        <Text style={styles.plusButtonText}>SongBox Plus</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.publicProfileButton}
        onPress={() => navigation.navigate('PublicProfileScreen', { username: user?.username })}
        activeOpacity={0.86}
      >
        <Icon name="link" size={15} color="#F4E7C5" />
        <Text style={styles.publicProfileText}>View Public Profile</Text>
      </TouchableOpacity>
    </>
  ), [favoriteAlbums, favoriteArtists, isLoadingFavorites, profileImageSource, renderAlbumItem, renderArtistItem, setIsEditingUsername, user?.username, handlePickProfilePicture, isUploadingPicture, navigation, handleShareProfile, handleShareTop3, top3Items.length, currentlyPlaying?.is_playing, currentlyPlaying?.item?.cover_image, scrollY, badges, tasteWall]);

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

        <View ref={top3CaptureRef} collapsable={false} style={styles.profileShareCaptureWrap}>
          <Top3ShareCard
            username={user?.username || 'SongBox listener'}
            profileImageSource={profileImageSource}
            items={top3Items}
          />
        </View>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => navigation.navigate('SettingsScreen')}
        >
          <Icon name="cog" size={24} color="#fff" />
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
            nestedScrollEnabled
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            ListFooterComponent={
              <>
              {isLoadingFavorites ? <SkeletonList count={3} itemStyle={styles.songSkeletonItem} /> : null}
              {followingSection}
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

const BADGE_COLORS = {
  common: '#A9A0B8',
  uncommon: '#7AE7C7',
  rare: '#BBA7FF',
  epic: '#FFD166',
};

const BadgesSection = React.memo(function BadgesSection({ badges }) {
  if (!badges || badges.length === 0) return null;
  return (
    <View style={styles.badgesCard}>
      <View style={styles.badgesHeader}>
        <Text style={styles.badgesTitle}>Taste Badges</Text>
        <Text style={styles.badgesCount}>{badges.length}</Text>
      </View>
      <View style={styles.badgesGrid}>
        {badges.map((badge) => (
          <View key={badge.id} style={styles.badgePill}>
            <Icon name={badge.icon} size={13} color={BADGE_COLORS[badge.rarity] || '#A9A0B8'} />
            <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
          </View>
        ))}
      </View>
    </View>
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

const Top3ShareCard = React.memo(function Top3ShareCard({
  username,
  profileImageSource,
  items,
}) {
  return (
    <View style={styles.top3ShareCard}>
      <View style={styles.top3ShareAura} />
      <Text style={styles.top3ShareKicker}>My Top 3</Text>
      <View style={styles.top3ShareIdentity}>
        <Image source={profileImageSource} style={styles.top3ShareImage} contentFit="cover" />
        <Text style={styles.top3ShareName} numberOfLines={1}>{username}</Text>
      </View>
      <View style={styles.top3List}>
        {items.map((item, index) => (
          <View key={`${item.entityType}-${item.entityId}-${index}`} style={styles.top3Item}>
            <Text style={styles.top3Rank}>#{index + 1}</Text>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.top3ItemImage} contentFit="cover" />
            ) : (
              <View style={styles.top3ItemImagePlaceholder} />
            )}
            <View style={styles.top3ItemInfo}>
              <Text style={styles.top3ItemName} numberOfLines={1}>{item.name || item.entityId}</Text>
              <Text style={styles.top3ItemMeta}>{item.artist || item.typeLabel}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.top3Footer}>
        <Text style={styles.top3FooterText}>Made with SongBox</Text>
        <View style={styles.top3Mark} />
      </View>
    </View>
  );
});

const TasteWallSection = React.memo(function TasteWallSection({ data, navigation }) {
  const pinnedItems = data.top3Items || [];
  const recentFavorites = data.recentFavorites || [];

  const openItem = (item) => {
    if (item.entityType === 'song') navigation.navigate('SongDetailsScreen', { songId: item.entityId });
    if (item.entityType === 'album') navigation.navigate('AlbumDetailsScreen', { album: { id: item.entityId } });
    if (item.entityType === 'artist') navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
  };

  return (
    <View style={styles.tasteWallCard}>
      <View style={styles.tasteWallHeader}>
        <View>
          <Text style={styles.tasteWallKicker}>Taste Wall</Text>
          <Text style={styles.tasteWallTitle}>{data.currentEra}</Text>
        </View>
        <View style={styles.tasteWallStamp}>
          <Text style={styles.tasteWallStampText}>{data.totalFavorites}</Text>
          <Text style={styles.tasteWallStampLabel}>saves</Text>
        </View>
      </View>

      <View style={styles.tasteDnaRow}>
        <View style={styles.tasteDnaPill}>
          <Text style={styles.tasteDnaValue}>{data.dominantType}</Text>
          <Text style={styles.tasteDnaLabel}>main lane</Text>
        </View>
        <View style={styles.tasteDnaPill}>
          <Text style={styles.tasteDnaValue}>{pinnedItems.length || '...'}</Text>
          <Text style={styles.tasteDnaLabel}>pinned</Text>
        </View>
      </View>

      {pinnedItems.length > 0 ? (
        <View style={styles.pinnedGrid}>
          {pinnedItems.map((item, index) => (
            <TouchableOpacity key={`${item.entityType}-${item.entityId}-${index}`} style={styles.pinnedItem} onPress={() => openItem(item)} activeOpacity={0.86}>
              {item.image ? <Image source={{ uri: item.image }} style={styles.pinnedImage} contentFit="cover" /> : <View style={styles.pinnedImage} />}
              <Text style={styles.pinnedRank}>#{index + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.wallEmptyState}>
          <Text style={styles.wallEmptyTitle}>Build your pinned taste</Text>
          <Text style={styles.wallEmptyText}>Favorite albums, songs, and artists to turn this profile into your music diary.</Text>
        </View>
      )}

      {recentFavorites.length > 0 && (
        <View style={styles.recentWallList}>
          <Text style={styles.recentWallTitle}>Music Wall</Text>
          {recentFavorites.map((item, index) => (
            <TouchableOpacity key={`${item.entityType}-${item.entityId}-${index}`} style={styles.recentWallItem} onPress={() => openItem(item)} activeOpacity={0.86}>
              <View style={styles.wallAvatarMark}>
                <Icon name={item.source === 'spotify_api' ? 'spotify' : 'bookmark'} size={13} color="#171515" />
              </View>
              <View style={styles.recentWallCopy}>
                <Text style={styles.recentWallAction}>
                  {item.signalType === 'recent_play' ? 'Recently played' : item.signalType === 'top_artist' ? 'Top artist' : item.signalType === 'top_track' ? 'Top track' : item.signalType === 'rating' ? 'Rated' : 'Saved'}
                </Text>
                <Text style={styles.recentWallName} numberOfLines={1}>{item.name || item.entityId}</Text>
              </View>
              <Text style={styles.recentWallType}>{item.entityType}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

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
  top3ShareCard: {
    width: 360,
    minHeight: 640,
    padding: 24,
    borderRadius: 36,
    backgroundColor: '#201B27',
    overflow: 'hidden',
  },
  top3ShareAura: {
    position: 'absolute',
    right: -72,
    top: -72,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(187,167,255,0.22)',
  },
  top3ShareKicker: {
    color: '#BBA7FF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  top3ShareIdentity: {
    alignItems: 'center',
    marginTop: 28,
  },
  top3ShareImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(187,167,255,0.55)',
  },
  top3ShareName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 12,
    maxWidth: 290,
  },
  top3List: {
    marginTop: 28,
    gap: 14,
  },
  top3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  top3Rank: {
    color: '#FFD166',
    fontSize: 18,
    fontWeight: '900',
    width: 30,
    textAlign: 'center',
  },
  top3ItemImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2A2532',
  },
  top3ItemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2A2532',
  },
  top3ItemInfo: {
    flex: 1,
  },
  top3ItemName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  top3ItemMeta: {
    color: '#A9A0B8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  top3Footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  top3FooterText: {
    color: '#766E81',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  top3Mark: {
    width: 34,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#BBA7FF',
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: -6,
    zIndex: 2,
  },
  top3ShareButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#BBA7FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 9,
    elevation: 5,
  },
  listContainer: {
    paddingBottom: 150,
  },
  topRectangle: {
    width: '100%',
    height: 260,
    backgroundColor: '#35323285',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 55,
    zIndex: 1,
    overflow: 'hidden',
  },
  topRectangleBg: {
    ...StyleSheet.absoluteFillObject,
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
  tasteWallCard: {
    marginHorizontal: 15,
    marginTop: 16,
    padding: 18,
    borderRadius: 30,
    backgroundColor: '#211C29',
    borderWidth: 1,
    borderColor: 'rgba(244,231,197,0.12)',
    overflow: 'hidden',
  },
  tasteWallHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  tasteWallKicker: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tasteWallTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  tasteWallStamp: {
    minWidth: 64,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(244,231,197,0.12)',
    alignItems: 'center',
  },
  tasteWallStampText: {
    color: '#F4E7C5',
    fontSize: 18,
    fontWeight: '900',
  },
  tasteWallStampLabel: {
    color: '#B9AFC6',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tasteDnaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  tasteDnaPill: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tasteDnaValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  tasteDnaLabel: {
    color: '#AFA7B7',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  pinnedGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  pinnedItem: {
    flex: 1,
    aspectRatio: 0.78,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pinnedImage: {
    width: '100%',
    height: '100%',
  },
  pinnedRank: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    color: '#171515',
    fontSize: 12,
    fontWeight: '900',
    backgroundColor: '#F4E7C5',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  wallEmptyState: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  wallEmptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  wallEmptyText: {
    color: '#CFC5D8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  recentWallList: {
    marginTop: 16,
    gap: 8,
  },
  recentWallTitle: {
    color: '#F4E7C5',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recentWallItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  wallAvatarMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F4E7C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentWallCopy: {
    flex: 1,
  },
  recentWallAction: {
    color: '#AFA7B7',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recentWallType: {
    color: '#171515',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    backgroundColor: '#BBA7FF',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  recentWallName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
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
  badgesCard: {
    marginHorizontal: 15,
    marginTop: 18,
    padding: 18,
    borderRadius: 26,
    backgroundColor: 'rgba(32,27,39,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  badgesTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  badgesCount: {
    color: '#171515',
    backgroundColor: '#F4E7C5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '900',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeName: {
    color: '#D8D0E4',
    fontSize: 12,
    fontWeight: '800',
  },
  plusButton: {
    marginHorizontal: 15,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: '#FFD166',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  plusButtonText: {
    color: '#171515',
    fontSize: 15,
    fontWeight: '900',
  },
  publicProfileButton: {
    marginHorizontal: 15,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244,231,197,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publicProfileText: {
    color: '#F4E7C5',
    fontSize: 15,
    fontWeight: '900',
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
