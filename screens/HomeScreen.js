import React, { useRef, useEffect, useState, useContext, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import CoverImage from '../components/CoverImage';
import { SkeletonCard, SkeletonList } from '../components/Skeleton';
import { getUserId, normalizeAlbum, normalizeArtist, normalizeSong, resolveImageUrl } from '../utils/normalizers';
import { queryKeys } from '../api/queryKeys';
import {
  HOME_FEED_STALE_MS,
  readCachedHomeFeed,
  writeCachedHomeFeed,
} from '../utils/homeFeedCache';
import { useToast } from '../context/ToastContext';
import { openYouTubeUrl } from '../utils/externalLinks';

// Datos estáticos para el carrusel superior
const DATA = [
  { label: "New Album", title: "Short n' Sweet", artist: "Sabrina Carpenter", imageSource: require('../assets/sabrina.png') },
  { label: "Popular Album", title: "Vultures 1", artist: "Kanye West", imageSource: require('../assets/vultures.jpeg') },
  { label: "UTOPIA", title: "UTOPIA", artist: "Travis Scott", imageSource: require('../assets/travis.png') },
];

const EMPTY_HOME_SECTIONS = {
  newsData: [],
  artistsData: [],
  videosData: [],
  recentlyListenedData: [],
  moreAlbumsData: [],
  moreArtistsData: [],
  topRatedData: [],
  activityData: [],
};

const formatAlbum = (album) => {
  const normalizedAlbum = normalizeAlbum(album);
  const hasImage = normalizedAlbum.cover_image && typeof normalizedAlbum.cover_image === 'string' && normalizedAlbum.cover_image.startsWith('http');

  return {
    id: normalizedAlbum.id,
    title: normalizedAlbum.name,
    artist: normalizedAlbum.artist,
    imageSource: hasImage ? { uri: normalizedAlbum.cover_image } : null,
    release_date: normalizedAlbum.release_date,
    total_tracks: normalizedAlbum.total_tracks,
    type: normalizedAlbum.type,
    url: normalizedAlbum.url,
  };
};

const formatArtist = (artist) => {
  const normalizedArtist = normalizeArtist(artist);
  const hasImage = normalizedArtist.image && typeof normalizedArtist.image === 'string' && normalizedArtist.image.startsWith('http');

  return {
    id: normalizedArtist.id,
    name: normalizedArtist.name,
    genres: normalizedArtist.genres.length > 0 ? normalizedArtist.genres.join(', ') : null,
    popularity: normalizedArtist.popularity,
    imageSource: hasImage ? { uri: normalizedArtist.image } : null,
    url: normalizedArtist.url,
  };
};

const formatSong = (song) => {
  const normalizedSong = normalizeSong(song);
  const hasImage = normalizedSong.cover_image && typeof normalizedSong.cover_image === 'string' && normalizedSong.cover_image.startsWith('http');

  return {
    id: normalizedSong.id,
    title: normalizedSong.name,
    artist: normalizedSong.artist,
    album: normalizedSong.album,
    url: normalizedSong.url,
    imageSource: hasImage ? { uri: normalizedSong.cover_image } : null,
  };
};

const buildHomeFeedFromPayload = (payload) => ({
  newsData: (payload.albums || []).map(formatAlbum),
  artistsData: (payload.artists || []).map(formatArtist),
  videosData: [],
  recentlyListenedData: (payload.recentlyListened || []).map(formatSong),
  moreAlbumsData: (payload.moreAlbums || []).map(formatAlbum),
  moreArtistsData: (payload.moreArtists || []).map(formatArtist),
  topRated: payload.topRated || [],
  activity: payload.activity || [],
});

const applyHomeFeedToSections = (feed, setters) => {
  setters.setNewsData(feed.newsData || []);
  setters.setArtistsData(feed.artistsData || []);
  setters.setVideosData(feed.videosData || []);
  setters.setRecentlyListenedData(feed.recentlyListenedData || []);
  setters.setMoreAlbumsData(feed.moreAlbumsData || []);
  setters.setMoreArtistsData(feed.moreArtistsData || []);
  setters.setTopRatedData(feed.topRated || feed.topRatedData || []);
  setters.setActivityData(feed.activity || feed.activityData || []);
};

const SectionHeader = ({ eyebrow, title, count, actionLabel, onAction }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderCopy}>
      {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionHeaderMeta}>
      {typeof count === 'number' ? <Text style={styles.sectionCount}>{count}</Text> : null}
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
);

export default function HomeScreen({ navigation }) {
  const { axiosInstance, isLoading: isAuthLoading, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const userId = getUserId(user);

  const [activeTab, setActiveTab] = useState("News");
  const [newsData, setNewsData] = useState(EMPTY_HOME_SECTIONS.newsData);
  const [artistsData, setArtistsData] = useState(EMPTY_HOME_SECTIONS.artistsData);
  const [videosData, setVideosData] = useState(EMPTY_HOME_SECTIONS.videosData);
  const [moreAlbumsData, setMoreAlbumsData] = useState(EMPTY_HOME_SECTIONS.moreAlbumsData);
  const [moreArtistsData, setMoreArtistsData] = useState(EMPTY_HOME_SECTIONS.moreArtistsData);
  const [topRatedData, setTopRatedData] = useState(EMPTY_HOME_SECTIONS.topRatedData);
  const [activityData, setActivityData] = useState(EMPTY_HOME_SECTIONS.activityData);
  const [tabData, setTabData] = useState([]);
  const carouselRef = useRef();
  const tabScrollViewRef = useRef();
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const headerScrollY = useRef(new Animated.Value(0)).current;
  const [recentlyListenedData, setRecentlyListenedData] = useState([]);
  const carouselIndexRef = useRef(0);
  const isUserInteractingCarousel = useRef(false);

  const sectionSetters = useMemo(() => ({
    setNewsData,
    setArtistsData,
    setVideosData,
    setRecentlyListenedData,
    setMoreAlbumsData,
    setMoreArtistsData,
    setTopRatedData,
    setActivityData,
  }), []);

  const homeFeedQuery = useQuery({
    queryKey: queryKeys.homeFeed(userId),
    enabled: Boolean(userId && axiosInstance),
    staleTime: HOME_FEED_STALE_MS,
    queryFn: async () => {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      let payload = {};
      try {
        const response = await axiosInstance.get('/mobile/home', { timeout: 12000 });
        payload = response.data || {};
      } catch (error) {
        const cached = await readCachedHomeFeed(userId);
        if (cached) return { ...cached, isStaleFallback: true };
        throw error;
      }

      const homeFeed = {
        ...buildHomeFeedFromPayload(payload),
        ownerUserId: userId,
        cachedAt: Date.now(),
      };

      await writeCachedHomeFeed(userId, homeFeed);
      return homeFeed;
    },
  });

  useEffect(() => {
    applyHomeFeedToSections(EMPTY_HOME_SECTIONS, sectionSetters);
  }, [userId, sectionSetters]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const hydrateFromAsyncStorage = async () => {
      try {
        const cached = await readCachedHomeFeed(userId);
        if (cancelled || !cached) return;
        applyHomeFeedToSections(cached, sectionSetters);
      } catch {
        if (!cancelled) {
          showToast('Hubo un problema al inicializar la aplicación. Intenta nuevamente.');
        }
      }
    };

    hydrateFromAsyncStorage();
    return () => {
      cancelled = true;
    };
  }, [userId, sectionSetters, showToast]);

  useEffect(() => {
    if (!userId || !homeFeedQuery.data) return;
    if (homeFeedQuery.data.ownerUserId && String(homeFeedQuery.data.ownerUserId) !== String(userId)) return;
    applyHomeFeedToSections(homeFeedQuery.data, sectionSetters);
  }, [userId, homeFeedQuery.data, sectionSetters]);

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

  const featuredCarouselCount = featuredCarouselData.length;
  const featuredCardWidth = screenWidth - 52;
  const featuredCardSpacing = 12;
  const featuredSnapInterval = featuredCardWidth + featuredCardSpacing;
  const featuredCarouselPadding = (screenWidth - featuredCardWidth) / 2;
  const recentlyListenedCardWidth = screenWidth * 0.5;

  // Auto-advance featured carousel every 5s
  useEffect(() => {
    const totalItems = featuredCarouselCount || 1;
    const interval = setInterval(() => {
      if (isUserInteractingCarousel.current) return;
      const next = (carouselIndexRef.current + 1) % totalItems;
      carouselIndexRef.current = next;
        const offset = next * featuredSnapInterval;
        carouselRef.current?.scrollTo({ x: offset, animated: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [featuredCarouselCount, featuredSnapInterval]);

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
      style={[styles.largeContentCard, index % 3 === 0 && styles.largeContentCardWide]}
      onPress={() => item.id && navigation.navigate('AlbumDetailsScreen', { albumId: item.id })}
    >
      <CoverImage source={item.imageSource} style={[styles.largeContentImage, index % 3 === 0 && styles.largeContentImageWide]} />
      <Text style={styles.largeContentTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.largeContentSubtitle} numberOfLines={1}>{item.artist}</Text>
      {item.release_date ? <Text style={styles.contentMeta}>{item.release_date}</Text> : null}
    </TouchableOpacity>
  );

  const renderArtistCard = (item, index) => (
    <TouchableOpacity
      key={`${item.id || item.name}-${index}`}
      style={styles.artistCircleItem}
      onPress={() => item.id && navigation.navigate('ArtistDetailsScreen', {
        artistId: item.id,
        artistName: item.name,
      })}
    >
      <CoverImage source={item.imageSource} style={styles.artistCircleImage} />
      <Text style={styles.artistCircleName} numberOfLines={2}>{item.name}</Text>
      {item.genres ? <Text style={styles.artistCircleMeta} numberOfLines={1}>{item.genres}</Text> : null}
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

  const renderHorizontalSection = (title, data, renderItem, emptyText, eyebrow) => (
    <View style={styles.extraSection}>
      <SectionHeader eyebrow={eyebrow} title={title} count={data.length} />
      {homeFeedQuery.isFetching && data.length === 0 ? (
        renderCardSkeletonRow()
      ) : data.length > 0 ? (
        <FlatList
          horizontal
          data={data}
          renderItem={({ item, index }) => renderItem(item, index)}
          keyExtractor={(item, index) => `${item.id || item.entityId || item.title || item.name}-${index}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.extraSectionList}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={false}
        />
      ) : (
        <Text style={styles.emptySectionText}>{emptyText}</Text>
      )}
    </View>
  );

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView edges={[]} style={styles.container}>
      <Animated.ScrollView
        style={styles.scrollView}
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

        {homeFeedQuery.data?.isStaleFallback ? (
          <View style={styles.cacheNotice}>
            <Text style={styles.cacheNoticeTitle}>Showing your saved feed</Text>
            <Text style={styles.cacheNoticeText}>Pull to refresh when your connection is back.</Text>
          </View>
        ) : null}

        <View style={styles.homeHeroIntro}>
          <Text style={styles.homeHeroKicker}>SongBox Today</Text>
          <Text style={styles.homeHeroTitle}>New sounds, recent plays, and your community pulse.</Text>
        </View>

        <ScrollView
          horizontal
          ref={carouselRef}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="center"
          decelerationRate="fast"
          snapToInterval={featuredSnapInterval}
          contentContainerStyle={[styles.carouselContainer, { paddingHorizontal: featuredCarouselPadding }]}
          onScrollBeginDrag={() => { isUserInteractingCarousel.current = true; }}
          onScrollEndDrag={() => { isUserInteractingCarousel.current = false; }}
          onMomentumScrollEnd={(e) => {
            isUserInteractingCarousel.current = false;
            const page = Math.round(e.nativeEvent.contentOffset.x / featuredSnapInterval);
            carouselIndexRef.current = page;
          }}
        >
          {featuredCarouselData.map((item, index) => (
            <View key={index} style={[styles.albumSection, { width: featuredCardWidth, marginRight: index === featuredCarouselData.length - 1 ? 0 : featuredCardSpacing }]}> 
              <View style={styles.albumInfo}>
                <Text style={styles.albumLabel}>{item.label}</Text>
                <Text style={styles.albumTitle}>{item.title}</Text>
                <Text style={styles.albumArtist}>{item.artist}</Text>
              </View>
              <View style={styles.albumImageContainer}>
                <CoverImage source={item.imageSource} style={styles.albumImage} />
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
              onPress={async () => {
                if (activeTab === "Videos" && item.url) {
                  const opened = await openYouTubeUrl(item.url);
                  if (!opened) showToast('No se pudo abrir el enlace.');
                } else if (activeTab === "News" && item.id) {
                  navigation.navigate('AlbumDetailsScreen', { albumId: item.id });
                } else if (activeTab === "Artist" && item.id) {
                  navigation.navigate('ArtistDetailsScreen', {
                    artistId: item.id,
                    artistName: item.name,
                  });
                } else {
                  showToast('Esta funcionalidad aún no está disponible.');
                }
              }}
            >
              <CoverImage source={item.imageSource} style={styles.artistImage} />
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
          <SectionHeader eyebrow="Your rotation" title="Recently Listened" count={recentlyListenedData.length} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentlyListenedScrollContent}>
            {homeFeedQuery.isFetching && recentlyListenedData.length === 0 ? Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} style={[styles.songCard, { width: recentlyListenedCardWidth }]} imageStyle={styles.songImage} />
            )) : recentlyListenedData.map((song, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.songCard, { width: recentlyListenedCardWidth }]}
                onPress={() => {
                  if (song.id) {
                    navigation.navigate('SongDetailsScreen', {
                      songId: song.id,
                      songName: song.title,
                    });
                  } else {
                    showToast('Esta funcionalidad aún no está disponible.');
                  }
                }}
              >
                <CoverImage source={song.imageSource} style={styles.songImage} />
                <View style={styles.songInfoContainerRecentlyListened}>
                  <Text style={styles.songTitleRecentlyListened} numberOfLines={1}>{song.title}</Text>
                  <Text style={styles.songArtistRecentlyListened} numberOfLines={1}>{song.artist}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {renderHorizontalSection('New Releases', newsData, renderAlbumCard, 'No hay lanzamientos nuevos disponibles.', 'Fresh shelf')}
        {renderHorizontalSection('Trending Artists', artistsData, renderArtistCard, 'No hay artistas disponibles.', 'Discovery lane')}
        {renderHorizontalSection('More Releases', moreAlbumsData, renderAlbumCard, 'Haz pull-to-refresh para intentar cargar más álbumes.', 'Keep digging')}
        {renderHorizontalSection('More Artists', moreArtistsData, renderArtistCard, 'Haz pull-to-refresh para intentar cargar más artistas.', 'More voices')}

        {/* Top Rated Charts */}
        <View style={styles.extraSection}>
          <SectionHeader eyebrow="SongBox charts" title="Top Rated" count={topRatedData.length} actionLabel="Charts" onAction={() => navigation.navigate('ChartsScreen')} />
          {homeFeedQuery.isFetching && topRatedData.length === 0 ? (
            renderCardSkeletonRow()
          ) : topRatedData.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.extraSectionList}>
              {topRatedData.map((item, index) => (
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
                    <CoverImage source={item.image ? { uri: item.image } : null} style={styles.chartImage} />
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
        </View>

        {/* Activity Feed */}
        <View style={styles.extraSection}>
          <SectionHeader eyebrow="Community" title="Recent Activity" count={activityData.length} actionLabel="Activity" onAction={() => navigation.navigate('ActivityScreen')} />
          {homeFeedQuery.isFetching && activityData.length === 0 ? (
            <SkeletonList count={3} itemStyle={styles.activitySkeletonItem} />
          ) : activityData.length > 0 ? (
            <View style={styles.activityList}>
              {activityData.slice(0, 5).map((activity, index) => (
                <TouchableOpacity
                  key={`activity-${index}`}
                  style={styles.activityItem}
                  onPress={() => {
                    if (activity.entityType === 'song' && activity.entityId) {
                      navigation.navigate('SongDetailsScreen', { songId: activity.entityId });
                    } else if (activity.entityType === 'album' && activity.entityId) {
                      navigation.navigate('AlbumDetailsScreen', { albumId: activity.entityId });
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
  scrollView: {
    flex: 1,
    backgroundColor: '#171515',
  },
  contentContainer: {
    paddingTop: 0,
    paddingBottom: 170,
    backgroundColor: '#171515',
  },
  stickyHeader: {
    height: 84,
    paddingTop: 18,
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
  cacheNotice: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(244,231,197,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(244,231,197,0.16)',
  },
  cacheNoticeTitle: {
    color: '#F4E7C5',
    fontSize: 13,
    fontWeight: '900',
  },
  cacheNoticeText: {
    color: '#CFC5D8',
    fontSize: 12,
    marginTop: 3,
  },
  homeHeroIntro: {
    paddingHorizontal: 22,
    marginTop: 4,
    marginBottom: 14,
  },
  homeHeroKicker: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  homeHeroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 31,
    marginTop: 5,
  },

  carouselContainer: {
    alignItems: 'center'
  },
  albumSection: {
    height: 136,
    backgroundColor: '#A071CA',
    borderRadius: 26,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 10px 24px rgba(160,113,202,0.24)',
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
    right: -24,
    top: -14,
    overflow: 'hidden',
    zIndex: 2
  },
  albumImage: {
    width: 196,
    height: 208,
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
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionEyebrow: {
    color: '#A071CA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  sectionHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCount: {
    color: '#171515',
    backgroundColor: '#F4E7C5',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
  },
  sectionAction: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
  },
  recentlyListenedContainer: { 
    marginVertical: 14,
  },
  recentlyListenedScrollContent: {
    paddingHorizontal: 20,
    paddingRight: 28,
  },
  songCard: { 
    marginRight: 16,
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderRadius: 24,
    flexDirection: 'column',
    alignItems: 'center', 
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 6px 14px rgba(0,0,0,0.16)',
  },
  songImage: { 
    width: '100%', 
    height: 176, 
    borderRadius: 18, 
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
  },
  extraSectionList: {
    paddingHorizontal: 20,
  },
  largeContentCard: {
    width: 170,
    marginRight: 16,
    padding: 12,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  largeContentCardWide: {
    width: 196,
    borderRadius: 30,
  },
  largeContentCardCompact: {
    width: 154,
    borderRadius: 34,
  },
  largeArtistContentCard: {
    backgroundColor: 'rgba(160,113,202,0.12)',
  },
  artistCircleItem: {
    width: 180,
    marginRight: 22,
    alignItems: 'center',
  },
  artistCircleItemSmall: {
    width: 160,
    marginTop: 10,
  },
  artistCircleImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 12,
  },
  artistCircleImageSmall: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  artistCircleName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  artistCircleMeta: {
    color: '#D9D0E7',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  largeContentImage: {
    width: '100%',
    height: 160,
    borderRadius: 20,
    marginBottom: 10,
  },
  largeContentImageWide: {
    height: 138,
    borderRadius: 24,
  },
  largeArtistContentImage: {
    borderRadius: 28,
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
    width: 170,
    marginRight: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    overflow: 'hidden',
    boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
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
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#A071CA',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
