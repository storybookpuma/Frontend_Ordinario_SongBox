import React, { useRef, useEffect, useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonCard, SkeletonList } from '../components/Skeleton';
import { normalizeAlbum, normalizeArtist, normalizeSong, resolveImageUrl } from '../utils/normalizers';
import { queryKeys } from '../api/queryKeys';
import { useCharts } from '../hooks/useCharts';
import { useActivity } from '../hooks/useActivity';
import { useToast } from '../context/ToastContext';

// Datos estáticos para el carrusel superior
const DATA = [
  { label: "New Album", title: "Short n' Sweet", artist: "Sabrina Carpenter", imageSource: require('../assets/sabrina.png') },
  { label: "Popular Album", title: "Vultures 1", artist: "Kanye West", imageSource: require('../assets/vultures.jpeg') },
  { label: "UTOPIA", title: "UTOPIA", artist: "Travis Scott", imageSource: require('../assets/travis.png') },
];

const HOME_CACHE_KEY = 'homeSpotifyFeed:v2';

const formatAlbum = (album) => {
  const normalizedAlbum = normalizeAlbum(album);

  return {
    id: normalizedAlbum.id,
    title: normalizedAlbum.name,
    artist: normalizedAlbum.artist,
    imageSource: normalizedAlbum.cover_image ? { uri: normalizedAlbum.cover_image } : require('../assets/joji.jpg'),
    release_date: normalizedAlbum.release_date,
    total_tracks: normalizedAlbum.total_tracks,
    type: normalizedAlbum.type,
    url: normalizedAlbum.url,
  };
};

const formatArtist = (artist) => {
  const normalizedArtist = normalizeArtist(artist);

  return {
    id: normalizedArtist.id,
    name: normalizedArtist.name,
    genres: normalizedArtist.genres.length > 0 ? normalizedArtist.genres.join(', ') : null,
    popularity: normalizedArtist.popularity,
    imageSource: normalizedArtist.image ? { uri: normalizedArtist.image } : require('../assets/joji.jpg'),
    url: normalizedArtist.url,
  };
};

const formatSong = (song) => {
  const normalizedSong = normalizeSong(song);

  return {
    id: normalizedSong.id,
    title: normalizedSong.name,
    artist: normalizedSong.artist,
    album: normalizedSong.album,
    url: normalizedSong.url,
    imageSource: normalizedSong.cover_image ? { uri: normalizedSong.cover_image } : require('../assets/joji.jpg'),
  };
};

export default function HomeScreen({ navigation }) {
  const { axiosInstance, isLoading: isAuthLoading, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { width: screenWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState("News");
  const [newsData, setNewsData] = useState([]);
  const [artistsData, setArtistsData] = useState([]);
  const [videosData, setVideosData] = useState([]);
  const [moreAlbumsData, setMoreAlbumsData] = useState([]);
  const [moreArtistsData, setMoreArtistsData] = useState([]);
  const [isFetchingHome, setIsFetchingHome] = useState(false);
  const [tabData, setTabData] = useState([]);
  const carouselRef = useRef();
  const tabScrollViewRef = useRef();
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const headerScrollY = useRef(new Animated.Value(0)).current;
  const [recentlyListenedData, setRecentlyListenedData] = useState([]);

  const chartsQuery = useCharts({ entityType: 'song', limit: 10 });
  const activityQuery = useActivity({ limit: 10 });

  const homeFeedQuery = useQuery({
    queryKey: queryKeys.homeFeed,
    enabled: Boolean(user && axiosInstance),
    queryFn: async () => {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      const [albumsResult, artistsResult, recentlyListenedResult, moreAlbumsResult, moreArtistsResult] = await Promise.allSettled([
        axiosInstance.get('/top_albums_global', { params: { limit: 20, offset: 0 } }),
        axiosInstance.get('/top_artists_global', { params: { limit: 20, offset: 0 } }),
        axiosInstance.get('/recently_listened'),
        axiosInstance.get('/top_albums_global', { params: { limit: 20, offset: 20 } }),
        axiosInstance.get('/top_artists_global', { params: { limit: 20, offset: 20 } }),
      ]);

      const homeFeed = {
        newsData: (albumsResult.status === 'fulfilled' ? albumsResult.value.data.albums : []).map(formatAlbum),
        artistsData: (artistsResult.status === 'fulfilled' ? artistsResult.value.data.artists : []).map(formatArtist),
        videosData: [],
        recentlyListenedData: (recentlyListenedResult.status === 'fulfilled' ? recentlyListenedResult.value.data.songs : []).map(formatSong),
        moreAlbumsData: (moreAlbumsResult.status === 'fulfilled' ? moreAlbumsResult.value.data.albums : []).map(formatAlbum),
        moreArtistsData: (moreArtistsResult.status === 'fulfilled' ? moreArtistsResult.value.data.artists : []).map(formatArtist),
        cachedAt: Date.now(),
      };

      await AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify(homeFeed));
      return homeFeed;
    },
  });

  useEffect(() => {
    if (!homeFeedQuery.data) return;
    setNewsData(homeFeedQuery.data.newsData || []);
    setArtistsData(homeFeedQuery.data.artistsData || []);
    setVideosData(homeFeedQuery.data.videosData || []);
    setRecentlyListenedData(homeFeedQuery.data.recentlyListenedData || []);
    setMoreAlbumsData(homeFeedQuery.data.moreAlbumsData || []);
    setMoreArtistsData(homeFeedQuery.data.moreArtistsData || []);
  }, [homeFeedQuery.data]);

  const fetchData = useCallback(async () => {
    setIsFetchingHome(true);
    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      const [albumsResult, artistsResult, recentlyListenedResult, moreAlbumsResult, moreArtistsResult] = await Promise.allSettled([
        axiosInstance.get('/top_albums_global', { params: { limit: 20, offset: 0 } }),
        axiosInstance.get('/top_artists_global', { params: { limit: 20, offset: 0 } }),
        axiosInstance.get('/recently_listened'),
        axiosInstance.get('/top_albums_global', { params: { limit: 20, offset: 20 } }),
        axiosInstance.get('/top_artists_global', { params: { limit: 20, offset: 20 } }),
      ]);

      const albums = albumsResult.status === 'fulfilled' ? albumsResult.value.data.albums : [];
      const artists = artistsResult.status === 'fulfilled' ? artistsResult.value.data.artists : [];
      const recentlyListened = recentlyListenedResult.status === 'fulfilled'
        ? recentlyListenedResult.value.data.songs
        : [];
      const moreAlbums = moreAlbumsResult.status === 'fulfilled' ? moreAlbumsResult.value.data.albums : [];
      const moreArtists = moreArtistsResult.status === 'fulfilled' ? moreArtistsResult.value.data.artists : [];

      const formattedNewsData = albums.map(formatAlbum);
      setNewsData(formattedNewsData);

      const formattedArtistsData = artists.map(formatArtist);
      setArtistsData(formattedArtistsData);

      const formattedRecentlyListened = recentlyListened.map(formatSong);
      setRecentlyListenedData(formattedRecentlyListened);

      const formattedMoreAlbumsData = moreAlbums.map(formatAlbum);
      const formattedMoreArtistsData = moreArtists.map(formatArtist);
      setMoreAlbumsData(formattedMoreAlbumsData);
      setMoreArtistsData(formattedMoreArtistsData);

      await AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify({
        newsData: formattedNewsData,
        artistsData: formattedArtistsData,
        videosData: [],
        recentlyListenedData: formattedRecentlyListened,
        moreAlbumsData: formattedMoreAlbumsData,
        moreArtistsData: formattedMoreArtistsData,
        cachedAt: Date.now(),
      }));

      if (
        albumsResult.status === 'rejected' ||
        artistsResult.status === 'rejected' ||
        recentlyListenedResult.status === 'rejected' ||
        moreAlbumsResult.status === 'rejected' ||
        moreArtistsResult.status === 'rejected'
      ) {
        console.warn('Spotify data partially unavailable. User may need to reconnect Spotify.');
      }
    } catch (_error) {
      showToast("Hubo un problema al cargar los datos. Intenta nuevamente.");
    } finally {
      setIsFetchingHome(false);
    }
  }, [axiosInstance, showToast]);

  useEffect(() => {
    const initialize = async () => {
      try {
        if (!user) {
          return;
        }
        const cachedHomeFeed = await AsyncStorage.getItem(HOME_CACHE_KEY);

        if (cachedHomeFeed) {
          const parsedCache = JSON.parse(cachedHomeFeed);
          setNewsData(parsedCache.newsData || []);
          setArtistsData(parsedCache.artistsData || []);
          setVideosData(parsedCache.videosData || []);
          setRecentlyListenedData(parsedCache.recentlyListenedData || []);
          setMoreAlbumsData(parsedCache.moreAlbumsData || []);
          setMoreArtistsData(parsedCache.moreArtistsData || []);
        }
      } catch (_error) {
        showToast("Hubo un problema al inicializar la aplicación. Intenta nuevamente.");
      }
    };

    initialize();
  }, [fetchData, user, showToast]);

  useEffect(() => {
    if (activeTab === "News") {
      setTabData(newsData);
    } else if (activeTab === "Videos") {
      setTabData(videosData);
    } else if (activeTab === "Artist") {
      setTabData(artistsData);
    }
  }, [activeTab, newsData, artistsData, videosData]);

  const handleTabPress = (tab, index) => {
    setActiveTab(tab);
    Animated.spring(indicatorAnim, {
      toValue: index * (screenWidth / 3),
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();

    if (tabScrollViewRef.current) {
      tabScrollViewRef.current.scrollTo({ x: 0, animated: false });
    }
  };

  const onRefresh = async () => {
    await homeFeedQuery.refetch();
  };

  const featuredCarouselData = newsData.length > 0
    ? newsData.slice(0, 5).map(item => ({
      label: item.type ? item.type.replace('_', ' ').toUpperCase() : 'New Release',
      title: item.title,
      artist: item.artist,
      imageSource: item.imageSource,
      id: item.id,
    }))
    : DATA;

  const logoScale = headerScrollY.interpolate({
    inputRange: [0, 90],
    outputRange: [1, 0.42],
    extrapolate: 'clamp',
  });

  const headerOpacity = headerScrollY.interpolate({
    inputRange: [0, 90],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const renderAlbumCard = (item, index) => (
    <TouchableOpacity
      key={`${item.id || item.title}-${index}`}
      style={styles.largeContentCard}
      onPress={() => item.id && navigation.navigate('AlbumDetailsScreen', { album: item })}
    >
      <Image source={item.imageSource} style={styles.largeContentImage} />
      <Text style={styles.largeContentTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.largeContentSubtitle} numberOfLines={1}>{item.artist}</Text>
      {item.release_date ? <Text style={styles.contentMeta}>{item.release_date}</Text> : null}
    </TouchableOpacity>
  );

  const renderArtistCard = (item, index) => (
    <TouchableOpacity
      key={`${item.id || item.name}-${index}`}
      style={styles.largeContentCard}
      onPress={() => item.id && navigation.navigate('ArtistDetailsScreen', {
        artistId: item.id,
        artistName: item.name,
        artist: item,
      })}
    >
      <Image source={item.imageSource} style={styles.largeContentImage} />
      <Text style={styles.largeContentTitle} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.largeContentSubtitle} numberOfLines={1}>{item.genres || 'Featured artist'}</Text>
      {item.popularity ? <Text style={styles.contentMeta}>{item.popularity}% popularity</Text> : null}
    </TouchableOpacity>
  );

  const renderCardSkeletonRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.extraSectionList}>
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard key={index} style={styles.largeContentCard} imageStyle={styles.largeContentImage} />
      ))}
    </ScrollView>
  );

  const renderHorizontalSection = (title, data, renderItem, emptyText) => (
    <View style={styles.extraSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {(isFetchingHome || homeFeedQuery.isFetching) && data.length === 0 ? (
        renderCardSkeletonRow()
      ) : data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.extraSectionList}>
          {data.map(renderItem)}
        </ScrollView>
      ) : (
        <Text style={styles.emptySectionText}>{emptyText}</Text>
      )}
    </View>
  );

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Animated.ScrollView 
        contentContainerStyle={styles.contentContainer}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: headerScrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={homeFeedQuery.isRefetching} onRefresh={onRefresh} />
        }
      >
        <Animated.View
          style={[
            styles.stickyHeader,
            {
              opacity: headerOpacity,
              transform: [
                {
                  translateY: headerScrollY.interpolate({
                    inputRange: [0, 90],
                    outputRange: [0, -28],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        > 
          <Animated.Image
            source={require('../assets/Logo.png')}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Carrusel de arriba (Datos Estáticos) */}
        <ScrollView
          horizontal
          pagingEnabled
          ref={carouselRef}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="center"
          decelerationRate="fast"
          snapToInterval={screenWidth - 60}
          contentContainerStyle={styles.carouselContainer}
        >
          {featuredCarouselData.map((item, index) => (
            <View key={index} style={[styles.albumSection, { width: screenWidth - 60 }]}> 
              <View style={styles.albumInfo}>
                <Text style={styles.albumLabel}>{item.label}</Text>
                <Text style={styles.albumTitle}>{item.title}</Text>
                <Text style={styles.albumArtist}>{item.artist}</Text>
              </View>
              <View style={styles.albumImageContainer}>
                <Image source={item.imageSource} style={styles.albumImage} />
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Tabs de News, Videos y Artist */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsWrapper}>
            {["News", "Videos", "Artist"].map((tab, index) => (
              <TouchableOpacity key={tab} onPress={() => handleTabPress(tab, index)} style={styles.tabButton}>
                <Text style={[styles.tab, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Animated.View style={[styles.tabIndicator, { width: screenWidth / 3, transform: [{ translateX: indicatorAnim }] }]} />
        </View>

        {/* Carrusel de la pestaña activa */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.artistsContainer}
          contentContainerStyle={styles.artistsContentContainer}
        >
          {tabData.length > 0 ? tabData.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.artistCard, { width: screenWidth / 3 }]}
              onPress={() => {
                if (activeTab === "Videos" && item.url) {
                  Linking.openURL(item.url);
                } else if (activeTab === "News" && item.id) {
                  navigation.navigate('AlbumDetailsScreen', { album: item });
                } else if (activeTab === "Artist" && item.id) {
                  navigation.navigate('ArtistDetailsScreen', {
                    artistId: item.id,
                    artistName: item.name,
                    artist: item, 
                  });
                } else {
                  showToast('Esta funcionalidad aún no está disponible.');
                }
              }}
            >
              <Image source={item.imageSource} style={styles.artistImage} />
              <Text style={styles.artistCardTitle}>{item.title || item.name}</Text>
              {(activeTab === "News" || activeTab === "Videos") && item.artist && (
                <Text style={styles.artistCardName}>{item.artist}</Text>
              )}
              {activeTab === "Artist" && item.genres && (
                <Text style={styles.artistCardName}>{item.genres}</Text>
              )}
            </TouchableOpacity>
          )) : (
            <Text style={styles.emptySectionText}>
              {activeTab === "Videos" ? "Videos estará disponible cuando agreguemos la key de YouTube." : "No hay contenido disponible por ahora."}
            </Text>
          )}
        </ScrollView>

        {/* Escuchado Recientemente */}
        <View style={styles.recentlyListenedContainer}>
          <Text style={styles.sectionTitle}>Recently Listened</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(isFetchingHome || homeFeedQuery.isFetching) && recentlyListenedData.length === 0 ? Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} style={[styles.songCard, { width: screenWidth / 3 }]} imageStyle={styles.songImage} />
            )) : recentlyListenedData.map((song, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.songCard, { width: screenWidth / 3 }]}
                onPress={() => {
                  if (song.id) {
                    navigation.navigate('SongDetailsScreen', {
                      songId: song.id,
                      songName: song.title,
                      song: song, 
                    });
                  } else {
                    showToast('Esta funcionalidad aún no está disponible.');
                  }
                }}
              >
                <Image source={song.imageSource} style={styles.songImage} />
                <View style={styles.songInfoContainerRecentlyListened}>
                  <Text style={styles.songTitleRecentlyListened} numberOfLines={1}>{song.title}</Text>
                  <Text style={styles.songArtistRecentlyListened} numberOfLines={1}>{song.artist}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {renderHorizontalSection('New Releases', newsData, renderAlbumCard, 'No hay lanzamientos nuevos disponibles.')}
        {renderHorizontalSection('Trending Artists', artistsData, renderArtistCard, 'No hay artistas disponibles.')}
        {renderHorizontalSection('More Releases', moreAlbumsData, renderAlbumCard, 'Haz pull-to-refresh para intentar cargar más álbumes.')}
        {renderHorizontalSection('More Artists', moreArtistsData, renderArtistCard, 'Haz pull-to-refresh para intentar cargar más artistas.')}

        {/* Top Rated Charts */}
        <View style={styles.extraSection}>
          <Text style={styles.sectionTitle}>Top Rated</Text>
          {chartsQuery.isLoading ? (
            renderCardSkeletonRow()
          ) : chartsQuery.data?.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.extraSectionList}>
              {chartsQuery.data.map((item, index) => (
                <TouchableOpacity
                  key={`chart-${item.entityId || index}`}
                  style={styles.chartCard}
                  onPress={() => {
                    if (item.entityId) {
                      navigation.navigate('SongDetailsScreen', { songId: item.entityId });
                    }
                  }}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.chartImage} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.chartImage, { backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={styles.chartRankSmall}>#{index + 1}</Text>
                    </View>
                  )}
                  <Text style={styles.chartName} numberOfLines={1}>{item.name || item.entityId}</Text>
                  {item.artist ? (
                    <Text style={styles.chartArtist} numberOfLines={1}>{item.artist}</Text>
                  ) : null}
                  <View style={styles.chartRatingRow}>
                    <Text style={styles.chartRatingValue}>{item.averageRating?.toFixed(1)}</Text>
                    <Text style={styles.chartRatingStar}> ★</Text>
                    <Text style={styles.chartCountValue}> ({item.ratingCount})</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptySectionText}>No hay calificaciones aún.</Text>
          )}
          <TouchableOpacity style={styles.seeMoreButton} onPress={() => navigation.navigate('ChartsScreen')}>
            <Text style={styles.seeMoreText}>See all charts →</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Feed */}
        <View style={styles.extraSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {activityQuery.isLoading ? (
            <SkeletonList count={3} itemStyle={styles.activitySkeletonItem} />
          ) : activityQuery.data?.length > 0 ? (
            <View style={styles.activityList}>
              {activityQuery.data.slice(0, 5).map((activity, index) => (
                <TouchableOpacity
                  key={`activity-${index}`}
                  style={styles.activityItem}
                  onPress={() => {
                    if (activity.entityType === 'song' && activity.entityId) {
                      navigation.navigate('SongDetailsScreen', { songId: activity.entityId });
                    } else if (activity.entityType === 'album' && activity.entityId) {
                      navigation.navigate('AlbumDetailsScreen', { album: { id: activity.entityId } });
                    } else if (activity.entityType === 'artist' && activity.entityId) {
                      navigation.navigate('ArtistDetailsScreen', { artistId: activity.entityId });
                    } else if (activity.entityType === 'profile' && activity.entityId) {
                      navigation.navigate('UserDetailsScreen', { profileId: activity.entityId });
                    }
                  }}
                >
                  <View style={styles.activityHeader}>
                    {activity.userPhoto ? (
                      <Image
                        source={{ uri: resolveImageUrl(activity.userPhoto) }}
                        style={styles.activityAvatar}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.activityAvatar, styles.activityAvatarPlaceholder]}>
                        <Text style={styles.activityAvatarText}>
                          {(activity.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.activityHeaderContent}>
                      <View style={styles.activityHeaderTop}>
                        <Text style={styles.activityUsername}>{activity.username}</Text>
                        <Text style={styles.activityIconSmall}>
                          {activity.type === 'comment' ? '💬' : activity.type === 'rating' ? '⭐' : '❤️'}
                        </Text>
                      </View>
                      {activity.timestamp && (
                        <Text style={styles.activityTimestamp}>
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.activityText}>
                    {activity.type === 'comment' && `Commented on ${activity.name || activity.entityType}: "${activity.text}"`}
                    {activity.type === 'rating' && `Rated ${activity.name || activity.entityType} ${activity.rating}/10`}
                    {activity.type === 'favorite' && `Favorited ${activity.name || activity.entityType}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptySectionText}>No hay actividad reciente.</Text>
          )}
          <TouchableOpacity style={styles.seeMoreButton} onPress={() => navigation.navigate('ActivityScreen')}>
            <Text style={styles.seeMoreText}>See all activity →</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515'
  },
  contentContainer: {
    paddingTop: 0,
    paddingBottom: 120,
  },
  stickyHeader: {
    height: 104,
    paddingTop: 42,
    backgroundColor: '#171515',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logo: {
    width: 50,
    height: 50
  },
  carouselContainer: {
    alignItems: 'center'
  },
  albumSection: {
    height: 130,
    backgroundColor: '#A071CA',
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  albumInfo: {
    flex: 1,
    paddingRight: 80,
    paddingLeft: 10
  },
  albumLabel: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'left'
  },
  albumTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10
  },
  albumArtist: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 5,
    opacity: 0.6
  },
  albumImageContainer: {
    position: 'absolute',
    right: -30,
    top: -10,
    overflow: 'hidden',
    zIndex: 2
  },
  albumImage: {
    width: 190,
    height: 200,
    zIndex: 3,
    borderRadius: 10
  },
  tabsContainer: {
    marginTop: 20,
    marginBottom: 10,
    position: 'relative'
  },
  tabsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10
  },
  tab: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: 'bold',
    opacity: 0.9
  },
  activeTabText: {
    color: '#A071CA'
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: '#A071CA',
    borderRadius: 2
  },
  artistsContainer: {
    marginTop: 20,
    marginBottom: 10
  },
  artistsContentContainer: {
    paddingLeft: 20,
  },
  artistCard: {
    marginRight: 20
  },
  artistImage: {
    width: '100%',
    height: 200,
    borderRadius: 30
  },
  artistCardTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5
  },
  artistCardName: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.7
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10
  },
  recentlyListenedContainer: { 
    marginVertical: 10,
    paddingLeft: 20,
  },
  songCard: { 
    marginRight: 20,
    backgroundColor: '#2A2A2A',
    borderRadius: 15,
    flexDirection: 'column',
    alignItems: 'center', 
    padding: 10,
  },
  songImage: { 
    width: '100%', 
    height: 150, 
    borderRadius: 10, 
  },
  songInfoContainerRecentlyListened: {
    width: '100%',
    alignItems: 'center',
    marginTop: 5,
  },
  songTitleRecentlyListened: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  songArtistRecentlyListened: { 
    color: '#FFF', 
    fontSize: 14, 
    opacity: 0.7, 
    textAlign: 'center',
  },
  extraSection: {
    marginTop: 24,
    paddingLeft: 20,
  },
  extraSectionList: {
    paddingRight: 20,
  },
  largeContentCard: {
    width: 170,
    marginRight: 16,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  largeContentImage: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    marginBottom: 10,
  },
  largeContentTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  largeContentSubtitle: {
    color: '#D9D0E7',
    fontSize: 12,
    marginTop: 4,
  },
  contentMeta: {
    color: '#A071CA',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '700',
  },
  emptySectionText: {
    color: '#B9B0C7',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  chartCard: {
    width: 150,
    marginRight: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    overflow: 'hidden',
  },
  chartImage: {
    width: '100%',
    height: 130,
    borderRadius: 14,
    marginBottom: 8,
  },
  chartRankSmall: {
    color: '#A071CA',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chartName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  chartArtist: {
    color: '#D9D0E7',
    fontSize: 11,
    marginTop: 2,
  },
  chartRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  chartRatingValue: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chartRatingStar: {
    color: '#FFD700',
    fontSize: 12,
  },
  chartCountValue: {
    color: '#B9B0C7',
    fontSize: 12,
  },
  activityList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  activitySkeletonItem: {
    marginBottom: 8,
    height: 60,
  },
  activityItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(160,113,202,0.2)',
  },
  activityAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityAvatarText: {
    color: '#A071CA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activityHeaderContent: {
    flex: 1,
  },
  activityHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityIconSmall: {
    fontSize: 14,
  },
  activityUsername: {
    color: '#A071CA',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activityText: {
    color: '#FFF',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  activityTimestamp: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  seeMoreButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    marginLeft: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(160, 113, 202, 0.15)',
  },
  seeMoreText: {
    color: '#A071CA',
    fontSize: 14,
    fontWeight: '600',
  },
});
