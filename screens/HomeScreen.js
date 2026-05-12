import React, { useRef, useEffect, useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import MenuBar from '../components/MenuBar';
import LoadingScreen from '../components/LoadingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Datos estáticos para el carrusel superior
const DATA = [
  { label: "New Album", title: "Short n' Sweet", artist: "Sabrina Carpenter", imageSource: require('../assets/sabrina.png') },
  { label: "Popular Album", title: "Vultures 1", artist: "Kanye West", imageSource: require('../assets/vultures.jpeg') },
  { label: "UTOPIA", title: "UTOPIA", artist: "Travis Scott", imageSource: require('../assets/travis.png') },
];

const { width: screenWidth } = Dimensions.get('window');

// Definir claves de caché
const CACHE_KEYS = {
  NEWS_DATA: 'newsData',
  ARTISTS_DATA: 'artistsData',
  VIDEOS_DATA: 'videosData',
  RECENTLY_LISTENED_DATA: 'recentlyListenedData',
};

export default function HomeScreen({ navigation }) {
  const { axiosInstance, isLoading: isAuthLoading, user } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState("News");
  const [newsData, setNewsData] = useState([]);
  const [artistsData, setArtistsData] = useState([]);
  const [videosData, setVideosData] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingHome, setIsLoadingHome] = useState(true);
  const [tabData, setTabData] = useState([]);
  const carouselRef = useRef();
  const tabScrollViewRef = useRef();
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const [recentlyListenedData, setRecentlyListenedData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      const [albumsResult, artistsResult, recentlyListenedResult] = await Promise.allSettled([
        axiosInstance.get('/top_albums_global'),
        axiosInstance.get('/top_artists_global'),
        axiosInstance.get('/recently_listened'),
      ]);

      const albums = albumsResult.status === 'fulfilled' ? albumsResult.value.data.albums : [];
      const artists = artistsResult.status === 'fulfilled' ? artistsResult.value.data.artists : [];
      const recentlyListened = recentlyListenedResult.status === 'fulfilled'
        ? recentlyListenedResult.value.data.songs
        : [];

      // Procesar albums
      const formattedNewsData = albums.slice(0, 10).map(album => {
        const artistName = Array.isArray(album.artist)
          ? album.artist.join(', ')
          : (album.artist || album.artists?.join(', ') || 'Artista Desconocido');
        return {
          id: album.id,
          title: album.name,
          artist: artistName,
          imageSource: album.cover_image ? { uri: album.cover_image } : require('../assets/joji.jpg'),
          release_date: album.release_date,
          total_tracks: album.total_tracks,
          url: album.url,
        };
      });
      setNewsData(formattedNewsData);

      // Procesar artists
      const formattedArtistsData = artists.slice(0, 10).map(artist => ({
        id: artist.id, 
        name: artist.name,
        genres: artist.genres && artist.genres.length > 0 ? artist.genres.join(', ') : null,
        imageSource: artist.image ? { uri: artist.image } : require('../assets/joji.jpg'),
      }));
      setArtistsData(formattedArtistsData);

      const formattedRecentlyListened = recentlyListened.map(song => ({
        id: song.id,
        title: song.name,
        artist: song.artist,
        imageSource: { uri: song.cover_image },
      }));
      setRecentlyListenedData(formattedRecentlyListened);

      // Guardar datos en caché
      await AsyncStorage.setItem(CACHE_KEYS.NEWS_DATA, JSON.stringify(formattedNewsData));
      await AsyncStorage.setItem(CACHE_KEYS.ARTISTS_DATA, JSON.stringify(formattedArtistsData));
      await AsyncStorage.setItem(CACHE_KEYS.RECENTLY_LISTENED_DATA, JSON.stringify(formattedRecentlyListened));

      if (
        albumsResult.status === 'rejected' ||
        artistsResult.status === 'rejected' ||
        recentlyListenedResult.status === 'rejected'
      ) {
        console.warn('Spotify data partially unavailable. User may need to reconnect Spotify.');
      }

      try {
        const videosResponse = await axiosInstance.get('/videos');
        const formattedVideosData = videosResponse.data.videos.slice(0, 10).map(video => ({
          title: video.title,
          artist: video.channel,
          imageSource: { uri: video.thumbnail },
          url: video.url,
        }));
        setVideosData(formattedVideosData);
        await AsyncStorage.setItem(CACHE_KEYS.VIDEOS_DATA, JSON.stringify(formattedVideosData));
      } catch (videoError) {
        console.error("Error fetching videos:", videoError);
        Alert.alert("Error de Videos", "No se pudieron cargar los videos. Inténtalo más tarde.");
        setVideosData([]);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Hubo un problema al cargar los datos. Por favor, intenta nuevamente.");
    } finally {
      setIsLoadingHome(false);
    }
  }, [axiosInstance]);

  useEffect(() => {
    const initialize = async () => {
      try {
        if (!user) {
          return;
        }
        // Intentar cargar datos desde caché
        const [
          cachedNewsData,
          cachedArtistsData,
          cachedVideosData,
          cachedRecentlyListenedData
        ] = await Promise.all([
          AsyncStorage.getItem(CACHE_KEYS.NEWS_DATA),
          AsyncStorage.getItem(CACHE_KEYS.ARTISTS_DATA),
          AsyncStorage.getItem(CACHE_KEYS.VIDEOS_DATA),
          AsyncStorage.getItem(CACHE_KEYS.RECENTLY_LISTENED_DATA),
        ]);

        if (cachedNewsData && cachedArtistsData && cachedVideosData && cachedRecentlyListenedData) {
          setNewsData(JSON.parse(cachedNewsData));
          setArtistsData(JSON.parse(cachedArtistsData));
          setVideosData(JSON.parse(cachedVideosData));
          setRecentlyListenedData(JSON.parse(cachedRecentlyListenedData));
          setIsLoadingHome(false);
        } else {
          // Si no hay caché, obtener datos de la red
          fetchData();
        }
      } catch (error) {
        console.error("Error al inicializar la HomeScreen:", error);
        Alert.alert("Error", "Hubo un problema al inicializar la aplicación. Por favor, intenta nuevamente.");
      }
    };

    initialize();
  }, [fetchData, navigation, user]);

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
    setIsRefreshing(true);
    try {
      await fetchData();
    } catch (error) {
      console.error("Error al refrescar los datos:", error);
      Alert.alert("Error", "Hubo un problema al refrescar los datos. Por favor, intenta nuevamente.");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isAuthLoading || isLoadingHome) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        stickyHeaderIndices={[0]}
      >
        {/* Logo de la aplicación - Este será el sticky header */}
        <View style={styles.stickyHeader}>
          <Image source={require('../assets/Logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

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
          {DATA.map((item, index) => (
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
          <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: indicatorAnim }] }]} />
        </View>

        {/* Carrusel de la pestaña activa */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.artistsContainer}
          contentContainerStyle={styles.artistsContentContainer}
        >
          {tabData.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.artistCard}
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
                  Alert.alert('Información', 'Esta funcionalidad aún no está disponible.');
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
          ))}
        </ScrollView>

        {/* Escuchado Recientemente */}
        <View style={styles.recentlyListenedContainer}>
          <Text style={styles.sectionTitle}>Recently Listened</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentlyListenedData.map((song, index) => (
              <TouchableOpacity
                key={index}
                style={styles.songCard}
                onPress={() => {
                  if (song.id) {
                    navigation.navigate('SongDetailsScreen', {
                      songId: song.id,
                      songName: song.title,
                      song: song, 
                    });
                  } else {
                    Alert.alert('Información', 'Esta funcionalidad aún no está disponible.');
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
      </ScrollView>

      {/* Barra de menú inferior */}
      <MenuBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515'
  },
  contentContainer: {
    paddingVertical: 5
  },
  stickyHeader: {
    backgroundColor: '#171515', 
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    resizeMode: 'contain',
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
    width: screenWidth / 3,
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
    width: screenWidth / 3,
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
  },
  songCard: { 
    width: screenWidth / 3, 
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
});
