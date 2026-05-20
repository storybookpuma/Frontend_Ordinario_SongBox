import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Animated,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
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
import { SkeletonList } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { getUserId, splitFavorites, resolveImageUrl } from '../utils/normalizers';
import { useToast } from '../context/ToastContext';
import { shareViewCapture } from '../utils/shareCapture';
import { openSpotifyUrl } from '../utils/externalLinks';
import { waitForSpotifySyncJob } from '../utils/spotifySync';
import {
  BadgesSection,
  CollapsibleProfileSection,
  FavoriteCarouselSection,
  FollowingSection,
  ProfileShareCard,
  TasteWallSection,
  Top3ShareCard,
} from './profile/ProfileSections';

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
  const [shouldRenderProfileShare, setShouldRenderProfileShare] = useState(false);
  const [shouldRenderTop3Share, setShouldRenderTop3Share] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    albums: false,
    artists: false,
    songs: true,
    badges: false,
    following: true,
  });

  const {
    data: mobileProfile,
    isLoading: isLoadingProfile,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.mobileProfile(entityId),
    enabled: Boolean(entityId && axiosInstance),
    queryFn: async () => {
      const response = await axiosInstance.get('/mobile/profile/me');
      return response.data;
    },
    staleTime: 1000 * 60 * 3,
  });

  useEffect(() => {
    spotifySyncStarted.current = false;
    setNewUsername(user?.username || '');
    setIsEditingUsername(false);
    setShouldRenderProfileShare(false);
    setShouldRenderTop3Share(false);
  }, [entityId, user?.username]);

  useEffect(() => {
    const refreshUser = async () => {
      if (!user || entityId || !axiosInstance) return;

      setIsRefreshingUser(true);
      try {
        const response = await axiosInstance.get('/me');
        setUser(response.data.user);
      } catch {
      } finally {
        setIsRefreshingUser(false);
      }
    };

    refreshUser();
  }, [axiosInstance, entityId, setUser, user]);

  const favorites = useMemo(() => mobileProfile?.favorites || [], [mobileProfile?.favorites]);
  const isLoadingFavorites = isLoadingProfile;

  const { data: currentlyPlaying } = useSpotifyPlayback({ enabled: isFocused });
  const { data: badges = [] } = useBadges();

  const tasteWallData = mobileProfile?.tasteWall;

  useEffect(() => {
    if (!isFocused || !mobileProfile?.sync?.canSyncNow || !axiosInstance || spotifySyncStarted.current) return;
    spotifySyncStarted.current = true;
    const syncTimer = setTimeout(() => {
      axiosInstance.post('/spotify/sync')
        .then(async (response) => {
          if (response.data?.queued && response.data?.jobId) {
            const job = await waitForSpotifySyncJob(axiosInstance, response.data.jobId);
            if (job?.status === 'timeout') return;
          }
          refetchProfile();
        })
        .catch(() => {
          spotifySyncStarted.current = false;
        });
    }, 1200);

    return () => clearTimeout(syncTimer);
  }, [axiosInstance, isFocused, mobileProfile?.sync?.canSyncNow, refetchProfile]);

  const followingUsers = useMemo(() => mobileProfile?.followingUsers || [], [mobileProfile?.followingUsers]);
  const isLoadingFollowing = isLoadingProfile && followingIds.length > 0;

  const toggleSection = useCallback((section) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  }, []);

  const { albums: favoriteAlbums, songs: favoriteSongs, artists: favoriteArtists } = useMemo(
    () => splitFavorites(favorites),
    [favorites]
  );

  const handleShareProfile = useCallback(async () => {
    try {
      if (!shouldRenderProfileShare) {
        setShouldRenderProfileShare(true);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      await shareViewCapture(profileCaptureRef, `songbox-profile-${user?.username || 'user'}`);
    } catch (_error) {
      showToast('No se pudo compartir la captura del perfil.');
    }
  }, [shouldRenderProfileShare, showToast, user?.username]);

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
      if (!shouldRenderTop3Share) {
        setShouldRenderTop3Share(true);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      await shareViewCapture(top3CaptureRef, `songbox-top3-${user?.username || 'user'}`);
    } catch (_error) {
      showToast('No se pudo compartir el Top 3.');
    }
  }, [shouldRenderTop3Share, showToast, user?.username]);

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
      const opened = await openSpotifyUrl(url);
      if (!opened) showToast('No se pudo abrir Spotify.');
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
    } catch {
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
    } catch {
      showToast('No se pudo actualizar la foto de perfil.');
    } finally {
      setIsUploadingPicture(false);
    }
  }, [axiosInstance, showToast, setUser, user]);

  const renderAlbumItem = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.carouselItem}
      onPress={() => {
        navigation.navigate('AlbumDetailsScreen', { albumId: item.entityId });
      }}
    >
      <Image source={{ uri: item.image }} style={styles.albumImage} contentFit="cover" cachePolicy="memory-disk" />
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
      <Image source={{ uri: item.image }} style={styles.songImage} contentFit="cover" cachePolicy="memory-disk" />
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
      <Image source={{ uri: item.image }} style={styles.albumImage} contentFit="cover" cachePolicy="memory-disk" />
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

      <TasteWallSection styles={styles} data={tasteWall} navigation={navigation} />

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
        title="Favorite Albums"
        subtitle="Long plays on your shelf"
        count={favoriteAlbums.length}
        styles={styles}
        data={favoriteAlbums}
        isLoading={isLoadingFavorites}
        renderItem={renderAlbumItem}
        collapsed={collapsedSections.albums}
        onToggle={() => toggleSection('albums')}
      />

      <FavoriteCarouselSection
        title="Favorite Artists"
        subtitle="Voices shaping your taste"
        count={favoriteArtists.length}
        styles={styles}
        data={favoriteArtists}
        isLoading={isLoadingFavorites}
        renderItem={renderArtistItem}
        collapsed={collapsedSections.artists}
        onToggle={() => toggleSection('artists')}
      />

      <CollapsibleProfileSection
        styles={styles}
        title="Favorite Songs"
        subtitle="Tracks in rotation"
        count={favoriteSongs.length}
        collapsed={collapsedSections.songs}
        onToggle={() => toggleSection('songs')}
      />

      <BadgesSection
        styles={styles}
        badges={badges}
        collapsed={collapsedSections.badges}
        onToggle={() => toggleSection('badges')}
      />

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
  ), [favoriteAlbums, favoriteArtists, favoriteSongs.length, isLoadingFavorites, profileImageSource, renderAlbumItem, renderArtistItem, setIsEditingUsername, user?.username, handlePickProfilePicture, isUploadingPicture, navigation, handleShareProfile, handleShareTop3, top3Items.length, currentlyPlaying?.is_playing, currentlyPlaying?.item?.cover_image, scrollY, badges, tasteWall, collapsedSections.albums, collapsedSections.artists, collapsedSections.badges, collapsedSections.songs, toggleSection]);

  const followingSection = useMemo(() => (
    <FollowingSection
      styles={styles}
      followingCount={followingIds.length}
      followingUsers={followingUsers}
      isLoading={isLoadingFollowing}
      renderItem={renderFollowingItem}
      collapsed={collapsedSections.following}
      onToggle={() => toggleSection('following')}
    />
  ), [collapsedSections.following, followingIds.length, followingUsers, isLoadingFollowing, renderFollowingItem, toggleSection]);

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
        {shouldRenderProfileShare ? (
          <View ref={profileCaptureRef} collapsable={false} style={styles.profileShareCaptureWrap}>
            <ProfileShareCard
              styles={styles}
              username={user?.username || 'SongBox listener'}
              profileImageSource={profileImageSource}
              favoriteAlbums={favoriteAlbums.length}
              favoriteArtists={favoriteArtists.length}
              favoriteSongs={favoriteSongs.length}
              following={followingIds.length}
            />
          </View>
        ) : null}

        {shouldRenderTop3Share ? (
          <View ref={top3CaptureRef} collapsable={false} style={styles.profileShareCaptureWrap}>
            <Top3ShareCard
              styles={styles}
              username={user?.username || 'SongBox listener'}
              profileImageSource={profileImageSource}
              items={top3Items}
            />
          </View>
        ) : null}
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
            data={isLoadingFavorites || collapsedSections.songs ? [] : favoriteSongs}
            renderItem={renderSongItem}
            keyExtractor={(item) => item.entityId}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            ListFooterComponent={
              <>
              {isLoadingFavorites && !collapsedSections.songs ? <SkeletonList count={3} itemStyle={styles.songSkeletonItem} /> : null}
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
  profileSectionCard: {
    marginHorizontal: 15,
    marginTop: 16,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(32,27,39,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileSectionTitleWrap: {
    flex: 1,
  },
  profileSectionKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileSectionKicker: {
    color: '#AFA7B7',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  profileSectionCount: {
    color: '#171515',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#F4E7C5',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  profileSectionTitle: {
    color: '#FFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 4,
  },
  profileSectionChevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(244,231,197,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasteWallCard: {
    marginHorizontal: 15,
    marginTop: 16,
    padding: 18,
    borderRadius: 34,
    backgroundColor: '#211B2A',
    borderWidth: 1,
    borderColor: 'rgba(244,231,197,0.16)',
    overflow: 'hidden',
  },
  tasteWallAura: {
    position: 'absolute',
    right: -70,
    top: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(187,167,255,0.18)',
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
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  tasteWallSubtitle: {
    color: '#CFC5D8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 7,
    maxWidth: 230,
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
  tasteSignalRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },
  tasteDnaPill: {
    flex: 1,
    padding: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tasteSignalPillPrimary: {
    backgroundColor: 'rgba(244,231,197,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(244,231,197,0.16)',
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
  pinnedEditorialGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  pinnedHeroItem: {
    flex: 1.45,
    height: 214,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pinnedSideStack: {
    flex: 1,
    gap: 10,
  },
  pinnedSideItem: {
    height: 102,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  pinnedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
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
  pinnedHeroCopy: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  pinnedHeroLabel: {
    alignSelf: 'flex-start',
    color: '#171515',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    backgroundColor: '#BBA7FF',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  pinnedHeroName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 7,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 8,
  },
  pinnedSideName: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 9,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
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
