import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  FlatList,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import SearchBar from '../components/SearchBar';
import { SkeletonCard } from '../components/Skeleton';

export default function SearchScreen({ navigation }) {
  const { axiosInstance, isLoading: authLoading } = useContext(AuthContext);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Albums');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimeout = useRef(null);
  const resultsAnim = useRef(new Animated.Value(0)).current;
  const hasResults = searchResults.length > 0;
  const collageGap = 12;
  const collageItemWidth = (screenWidth - 40 - collageGap) / 2;

  useEffect(() => {
    Animated.spring(resultsAnim, {
      toValue: hasResults ? 1 : 0,
      useNativeDriver: true,
      stiffness: 130,
      damping: 18,
      mass: 0.9,
    }).start();
  }, [hasResults, resultsAnim]);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSearchResults([]);
    setSearchQuery('');
  };

  const categories = ['Albums', 'Songs', 'Profiles', 'Artists'];

  const performSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let endpoint = '';
      switch (selectedCategory) {
        case 'Albums':
          endpoint = '/search_album';
          break;
        case 'Songs':
          endpoint = '/search_song';
          break;
        case 'Artists':
          endpoint = '/search_artist';
          break;
        case 'Profiles':
          endpoint = '/search_profile';
          break;
        default:
          setSearchResults([]);
          setIsLoading(false);
          return;
      }

      if (!axiosInstance) {
        throw new Error("No se pudo establecer la conexión con el servidor.");
      }

      const response = await axiosInstance.get(endpoint, {
        params: {
          q: searchQuery,
          limit: 10,
        },
        timeout: 5000,
      });

      switch (selectedCategory) {
        case 'Albums':
          setSearchResults(response.data.albums || []);
          break;
        case 'Songs':
          setSearchResults(response.data.tracks || []);
          break;
        case 'Artists':
          setSearchResults(response.data.artists || []);
          break;
        case 'Profiles':
          setSearchResults(response.data.profiles || []);
          break;
        default:
          setSearchResults([]);
      }

    } catch (err) {
      console.error("Error fetching search results:", err);
      if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Data:", err.response.data);
        setError(`Error ${err.response.status}: ${err.response.data.message || 'Error fetching search results'}`);
      } else if (err.request) {
        console.error("Request made but no response received:", err.request);
        setError("No se pudo conectar con el servidor. Verifica tu conexión a internet.");
      } else {
        console.error("Error setting up the request:", err.message);
        setError("Error al configurar la solicitud.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [axiosInstance, searchQuery, selectedCategory]);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    debounceTimeout.current = setTimeout(() => {
      performSearch();
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [performSearch, searchQuery]);

  const handleResultPress = (item) => {
    if (selectedCategory === 'Albums') {
      navigation.navigate('AlbumDetailsScreen', { album: item });
    } else if (selectedCategory === 'Songs') {
      navigation.navigate('SongDetailsScreen', { song: item });
    } else if (selectedCategory === 'Artists') {
      navigation.navigate('ArtistDetailsScreen', { artistId: item.id, artistName: item.name });
    } else if (selectedCategory === 'Profiles') {
      navigation.navigate('UserDetailsScreen', { profileId: item.id });
    }
  };

  const getResultImage = (item) => (
    item.cover_image || item.image || item.profile_picture
      ? { uri: item.cover_image || item.image || item.profile_picture }
      : require('../assets/default_picture.png')
  );

  const getResultSubtitle = (item) => (
    selectedCategory === 'Albums' && item.artist
      ? Array.isArray(item.artist)
        ? item.artist.join(', ')
        : item.artist
      : selectedCategory === 'Songs' && item.artists
      ? item.artists.join(', ')
      : selectedCategory === 'Artists' && item.genres
      ? item.genres.join(', ')
      : selectedCategory === 'Profiles' && item.email
      ? item.email
      : null
  );

  const renderResultItem = ({ item, index }) => {
    return (
      <TouchableOpacity
        style={[
          styles.collageItem,
          {
            width: collageItemWidth,
            height: collageItemWidth,
          },
        ]}
        onPress={() => handleResultPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name || item.username || item.title || 'result'}`}
      >
        <Image source={getResultImage(item)} style={styles.collageImage} />
        <View style={styles.collageOverlay}>
          <Text style={styles.collageTitle} numberOfLines={2}>
            {item.name || item.username || item.title}
          </Text>
          {getResultSubtitle(item) ? (
            <Text style={styles.collageSubtitle} numberOfLines={1}>{getResultSubtitle(item)}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchSkeleton = (_, index) => (
    <SkeletonCard
      key={index}
      style={[styles.collageItem, { width: collageItemWidth, height: collageItemWidth }]}
      imageStyle={styles.skeletonCollageImage}
    />
  );

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <SkeletonCard style={{ width: 180 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.searchSection,
          !hasResults && styles.searchSectionCentered,
          {
            transform: [
              {
                translateY: resultsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight * 0.12, -28],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.logoAndSearchContainer}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/Logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.searchContainer}>
            <SearchBar 
              searchQuery={searchQuery} 
              handleSearchChange={handleSearchChange} 
            />
          </View>
        </View>

        <View style={styles.categoriesWrapper}>
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.categoriesRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleCategoryChange(item)}
                style={[
                  styles.categoryItem,
                  selectedCategory === item && styles.selectedCategoryItem
                ]}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategory === item && styles.selectedCategoryText
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Animated.View>

      {isLoading && (
        <View style={styles.searchSkeletonGrid}>
          {Array.from({ length: 6 }).map(renderSearchSkeleton)}
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!isLoading && searchResults.length === 0 && searchQuery.trim() !== '' && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>No se encontraron resultados.</Text>
        </View>
      )}

      <Animated.FlatList
        key="search-collage"
        data={searchResults}
        renderItem={renderResultItem}
        keyExtractor={(item, index) => item.id || index.toString()}
        numColumns={2}
        columnWrapperStyle={styles.collageRow}
        contentContainerStyle={[
          styles.searchResultsContainer,
          { opacity: hasResults ? 1 : 0 },
        ]}
        showsVerticalScrollIndicator={false}
        style={{
          opacity: resultsAnim,
          transform: [
            {
              translateY: resultsAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
          ],
        }}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  searchSection: {
    paddingHorizontal: 0,
    paddingTop: 20,
    paddingBottom: 0,
  },
  searchSectionCentered: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 0,
  },
  logoAndSearchContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 80,
    height: 80,
  },
  searchContainer: {
    width: '88%',
    maxWidth: 420,
  },
  categoriesWrapper: {
    width: '100%',
    marginTop: 10,
  },
  categoriesRow: {
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  categoryItem: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginVertical: 5,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#333',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCategoryItem: {
    backgroundColor: '#A071CA',
  },
  categoryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  searchSkeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  errorContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  noResultsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#FFF',
    fontSize: 16,
    opacity: 0.7,
  },
  searchResultsContainer: {
    paddingBottom: 130,
    paddingHorizontal: 20,
    paddingTop: 4,
    flexGrow: 1,
  },
  collageRow: {
    gap: 12,
    marginBottom: 12,
  },
  collageItem: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  collageImage: {
    width: '100%',
    height: '100%',
  },
  skeletonCollageImage: {
    flex: 1,
    height: undefined,
  },
  collageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    paddingTop: 34,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  collageTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  collageSubtitle: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    marginTop: 4,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultSubtitle: {
    color: '#A0A0A0',
    fontSize: 14,
    marginTop: 5,
  },
});
