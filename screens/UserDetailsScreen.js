import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Animated,
  Platform,
  Keyboard,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';

import CommentSection from '../components/CommentSection';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { getUserId, resolveImageUrl, splitFavorites } from '../utils/normalizers';
import { getApiErrorMessage } from '../utils/errors';
import { useToast } from '../context/ToastContext';
import { useProfileCompatibility } from '../hooks/useProfileCompatibility';
import { useFollowUser } from '../hooks/useFollowUser';
import { shareViewCapture } from '../utils/shareCapture';

export default function UserDetailsScreen({ route, navigation }) {
  const { profileId } = route.params;
  const { axiosInstance, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [profileData, setProfileData] = useState(null);
  const [shouldLoadCompatibility, setShouldLoadCompatibility] = useState(false);
  const commentRef = useRef(null);
  
  const entityId = profileId; 
  const userId = getUserId(user);

  const scrollY = useRef(new Animated.Value(0)).current;
  const matchCaptureRef = useRef(null);

  const [error, setError] = useState(null);

  // Determinar si el usuario actual sigue a este perfil
  const isFollowing = user && user.following && user.following.includes(profileId);

  const profileQuery = useQuery({
    queryKey: queryKeys.profileDetails(profileId, userId),
    enabled: Boolean(axiosInstance && profileId && userId),
    queryFn: async () => {
      const response = await axiosInstance.get('/profile_details', {
        params: { profile_id: profileId },
      });
      return response.data;
    },
  });

  const { data: compatibility } = useProfileCompatibility(profileId, { enabled: shouldLoadCompatibility });

  useEffect(() => {
    if (profileQuery.data) {
      setProfileData(profileQuery.data);
      setError(null);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (!profileQuery.data) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      setShouldLoadCompatibility(true);
    });
    return () => task.cancel();
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
  const currentUserImageSource = useMemo(() => {
    const resolved = resolveImageUrl(user?.profile_picture);
    return resolved ? { uri: resolved } : require('../assets/default_picture.png');
  }, [user?.profile_picture]);
  const { albums: favoriteAlbums, songs: favoriteSongs, artists: favoriteArtists } = splitFavorites(profileData?.favorites || []);
  const followUser = useFollowUser(profileId);

  const handleShareMatch = async () => {
    try {
      await shareViewCapture(matchCaptureRef, `songbox-match-${profileData?.username || 'profile'}`);
    } catch (_error) {
      showToast('No se pudo compartir el match.');
    }
  };
  const handleFollow = followUser.follow;
  const handleUnfollow = followUser.unfollow;

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

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
    <View style={styles.container} collapsable={false}>

        <View ref={matchCaptureRef} collapsable={false} style={styles.matchShareCaptureWrap}>
          <CompatibilityShareCard
            currentUsername={user?.username || 'You'}
            targetUsername={profileData.username || 'SongBox user'}
            currentImageSource={currentUserImageSource}
            targetImageSource={profileImageSource}
            compatibility={compatibility}
          />
        </View>

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
            ref={flatListRef}
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
                    <Text style={styles.compatibilityLabel}>{compatibility?.tasteLabel || 'Build overlap'}</Text>
                  </View>
                  <View style={styles.compatibilityMeta}>
                    <Text style={styles.compatibilityText}>{compatibility?.sharedCount || 0} shared favorites</Text>
                    <Text style={styles.compatibilityText}>{compatibility?.sharedRatingsCount || 0} similar ratings</Text>
                    <Text style={styles.compatibilityText} numberOfLines={1}>
                      {compatibility?.topSharedArtists?.[0]?.name || 'Save music to build overlap'}
                    </Text>
                    <TouchableOpacity style={styles.shareMatchButton} onPress={handleShareMatch} activeOpacity={0.86}>
                      <Text style={styles.shareMatchText}>Share Match</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {compatibility?.closestRatings?.length ? (
                  <View style={styles.ratingsStrip}>
                    <Text style={styles.ratingsStripTitle}>Closest ratings</Text>
                    {compatibility.closestRatings.map((item) => (
                      <View key={`${item.entityType}-${item.entityId}`} style={styles.ratingRow}>
                        <Text style={styles.ratingRowName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.ratingRowPills}>
                          <Text style={styles.ratingRowPill}>You {item.yourRating.toFixed(0)}</Text>
                          <Text style={styles.ratingRowPill}>Them {item.theirRating.toFixed(0)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

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
                            if (item.entityType === 'album') navigation.navigate('AlbumDetailsScreen', { albumId: item.entityId });
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
                            navigation.navigate('AlbumDetailsScreen', { albumId: item.entityId });
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
                  ref={commentRef}
                  entityType="profile"
                  entityId={entityId}
                />
              </>
            }
            data={[]} 
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 120 + keyboardHeight }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
          />

    </View>
  );
}

const CompatibilityShareCard = React.memo(function CompatibilityShareCard({
  currentUsername,
  targetUsername,
  currentImageSource,
  targetImageSource,
  compatibility,
}) {
  const sharedArtist = compatibility?.topSharedArtists?.[0]?.name || 'shared music taste';
  const score = compatibility?.score ?? 0;

  return (
    <View style={styles.matchShareCard}>
      <View style={styles.matchShareAura} />
      <Text style={styles.matchShareKicker}>SongBox Taste Match</Text>
      <View style={styles.matchShareAvatars}>
        <Image source={currentImageSource} style={styles.matchShareAvatar} contentFit="cover" />
        <View style={styles.matchShareScoreBubble}>
          <Text style={styles.matchShareScore}>{score}%</Text>
        </View>
        <Image source={targetImageSource} style={styles.matchShareAvatar} contentFit="cover" />
      </View>
      <Text style={styles.matchShareTitle} numberOfLines={2}>
        {currentUsername} x {targetUsername}
      </Text>
      <Text style={styles.matchShareLabel}>{compatibility?.tasteLabel || 'Build overlap'}</Text>
      <View style={styles.matchShareStats}>
        <View style={styles.matchShareStat}>
          <Text style={styles.matchShareStatValue}>{compatibility?.sharedCount || 0}</Text>
          <Text style={styles.matchShareStatLabel}>Shared favorites</Text>
        </View>
        <View style={styles.matchShareStat}>
          <Text style={styles.matchShareStatValue}>{compatibility?.sharedRatingsCount || 0}</Text>
          <Text style={styles.matchShareStatLabel}>Similar ratings</Text>
        </View>
      </View>
      <View style={styles.matchShareArtistBox}>
        <Text style={styles.matchShareArtistLabel}>Top shared signal</Text>
        <Text style={styles.matchShareArtistName} numberOfLines={1}>{sharedArtist}</Text>
      </View>
      <Text style={styles.matchShareFooter}>Made with SongBox</Text>
    </View>
  );
});


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  matchShareCaptureWrap: {
    position: 'absolute',
    left: -5000,
    top: 0,
    width: 360,
    zIndex: -1,
  },
  matchShareCard: {
    width: 360,
    minHeight: 640,
    padding: 24,
    borderRadius: 36,
    backgroundColor: '#201B27',
    overflow: 'hidden',
  },
  matchShareAura: {
    position: 'absolute',
    right: -80,
    top: -80,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(187,167,255,0.22)',
  },
  matchShareKicker: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  matchShareAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 46,
  },
  matchShareAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: 'rgba(244,231,197,0.55)',
  },
  matchShareScoreBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F4E7C5',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -10,
    zIndex: 2,
  },
  matchShareScore: {
    color: '#171515',
    fontSize: 30,
    fontWeight: '900',
  },
  matchShareTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 28,
  },
  matchShareLabel: {
    color: '#BBA7FF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  matchShareStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 34,
  },
  matchShareStat: {
    flex: 1,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  matchShareStatValue: {
    color: '#FFD166',
    fontSize: 24,
    fontWeight: '900',
  },
  matchShareStatLabel: {
    color: '#D8D0E4',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  matchShareArtistBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(187,167,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(187,167,255,0.18)',
  },
  matchShareArtistLabel: {
    color: '#BBA7FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  matchShareArtistName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },
  matchShareFooter: {
    color: '#766E81',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 34,
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
  shareMatchButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#171515',
  },
  shareMatchText: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
  },
  compatibilityLabel: {
    color: '#4D4129',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ratingsStrip: {
    marginTop: 18,
    marginHorizontal: 15,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ratingsStripTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  ratingRowName: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ratingRowPills: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingRowPill: {
    color: '#FFD166',
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(255,209,102,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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
});
