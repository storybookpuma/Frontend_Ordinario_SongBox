import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { 
  SafeAreaView,
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import SearchBar from '../components/SearchBar';
import MenuBar from '../components/MenuBar';

export default function SearchScreen({ navigation }) {
  const { axiosInstance, isLoading: authLoading } = useContext(AuthContext);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Albums');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimeout = useRef(null);

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

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A071CA" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchSection}>
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
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A071CA" />
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

      <FlatList
        data={searchResults}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultItem}
            onPress={() => handleResultPress(item)}
          >
            <Image
              source={
                item.cover_image || item.image || item.profile_picture
                  ? { uri: item.cover_image || item.image || item.profile_picture }
                  : require('../assets/default_picture.png')
              }
              style={styles.resultImage}
            />
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                {item.name || item.username || item.title}
              </Text>
              <Text style={styles.resultSubtitle} numberOfLines={1}>
                {selectedCategory === 'Albums' && item.artist
                  ? Array.isArray(item.artist)
                    ? item.artist.join(', ')
                    : item.artist
                  : selectedCategory === 'Songs' && item.artists
                  ? item.artists.join(', ')
                  : selectedCategory === 'Artists' && item.genres
                  ? item.genres.join(', ')
                  : selectedCategory === 'Profiles' && item.email
                  ? item.email
                  : null}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.searchResultsContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.menuContainer}>
        <MenuBar activeTab="SearchScreen" />
      </View>
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
    paddingBottom: 10,
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
    width: '100%',
  },
  categoriesWrapper: {
    width: '100%',
    marginTop: 10,
  },
  categoriesRow: {
    paddingVertical: 5,
    justifyContent: 'flex-start',
    alignItems: 'center',
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
    paddingBottom: 80,
    paddingHorizontal: 0,
    flexGrow: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
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
  menuContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,  
  },
});
