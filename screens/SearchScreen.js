import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import SearchBar from '../components/SearchBar';
import { SkeletonCard } from '../components/Skeleton';
import { queryKeys } from '../api/queryKeys';
import { getApiErrorMessage } from '../utils/errors';
import { useToast } from '../context/ToastContext';
import { useFavorites } from '../hooks/useFavorites';

const RECENT_SEARCHES_KEY = 'songbox:recent-searches';

export default function SearchScreen({ navigation }) {
  const { axiosInstance, isLoading: authLoading, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { isFavorite, invalidateFavorites } = useFavorites();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isFocused = useIsFocused();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Albums');
  const [recentSearches, setRecentSearches] = useState([]);

  const debounceTimeout = useRef(null);
  const resultsAnim = useRef(new Animated.Value(0)).current;
  const normalizedQuery = debouncedQuery.trim();
  const collageGap = 12;
  const collageItemWidth = (screenWidth - 40 - collageGap) / 2;

  const searchEndpoint = useMemo(() => {
    switch (selectedCategory) {
      case 'Albums':
        return '/search_album';
      case 'Songs':
        return '/search_song';
      case 'Artists':
        return '/search_artist';
      case 'Profiles':
        return '/search_profile';
      default:
        return '';
    }
  }, [selectedCategory]);

  const searchQueryResult = useQuery({
    queryKey: queryKeys.search(selectedCategory, normalizedQuery),
    enabled: Boolean(axiosInstance && normalizedQuery && searchEndpoint),
    queryFn: async () => {
      const response = await axiosInstance.get(searchEndpoint, {
        params: { q: normalizedQuery, limit: 10 },
        timeout: 5000,
      });

      switch (selectedCategory) {
        case 'Albums':
          return response.data.albums || [];
        case 'Songs':
          return response.data.tracks || [];
        case 'Artists':
          return response.data.artists || [];
        case 'Profiles':
          return response.data.profiles || [];
        default:
          return [];
      }
    },
  });

  const searchResults = searchQueryResult.data || [];
  const isLoading = searchQueryResult.isFetching && Boolean(normalizedQuery);
  const error = searchQueryResult.isError ? getApiErrorMessage(searchQueryResult.error, 'No se pudieron cargar los resultados.') : null;
  const hasResults = searchResults.length > 0;
  const hasActiveSearch = searchQuery.trim().length > 0;

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((stored) => {
      if (!isMounted || !stored) return;
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 6));
      } catch {
        setRecentSearches([]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    Animated.spring(resultsAnim, {
      toValue: hasActiveSearch ? 1 : 0,
      useNativeDriver: true,
      stiffness: 130,
      damping: 18,
      mass: 0.9,
    }).start();
  }, [hasActiveSearch, resultsAnim]);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    setDebouncedQuery('');
  };

  const saveRecentSearch = async (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const nextSearches = [trimmed, ...recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
    setRecentSearches(nextSearches);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextSearches));
  };

  const categories = ['Albums', 'Songs', 'Profiles', 'Artists'];

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (searchQuery.trim() === '') {
      setDebouncedQuery('');
      return undefined;
    }

    debounceTimeout.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    if (error) {
      showToast(error);
    }
  }, [error, showToast]);

  const handleResultPress = (item) => {
    saveRecentSearch(normalizedQuery);
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

  const categoryToEntityType = (cat) => {
    switch (cat) {
      case 'Albums': return 'album';
      case 'Songs': return 'song';
      case 'Artists': return 'artist';
      case 'Profiles': return 'profile';
      default: return '';
    }
  };

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ item, entityType, isFav }) => {
      if (isFav) {
        await axiosInstance.post('/remove_favorite', {
          entityType,
          entityId: item.id,
        });
      } else {
        await axiosInstance.post('/add_favorite', {
          entityType,
          entityId: item.id,
          name: item.name || item.title,
          image: item.cover_image || item.image,
          artist: item.artist || (item.artists ? item.artists.join(', ') : undefined),
        });
      }
    },
    onSuccess: () => {
      invalidateFavorites();
    },
    onError: () => {
      showToast('No se pudo actualizar favoritos.');
    },
  });

  const handleToggleFavorite = (item) => {
    if (!user) {
      showToast('Inicia sesión para guardar favoritos.');
      return;
    }
    const entityType = categoryToEntityType(selectedCategory);
    if (!entityType || entityType === 'profile') return;
    const fav = isFavorite(entityType, item.id);
    toggleFavoriteMutation.mutate({ item, entityType, isFav: fav });
  };

  const getResultSubtitle = (item) => (
    selectedCategory === 'Albums' && item.artist
      ? Array.isArray(item.artist)
        ? item.artist.join(', ')
        : item.artist
      : selectedCategory === 'Songs' && item.artists
      ? item.artists.join(', ')
      : selectedCategory === 'Artists' && item.genres
      ? item.genres.join(', ')
      : null
  );

  const renderResultItem = ({ item }) => {
    const entityType = categoryToEntityType(selectedCategory);
    const fav = entityType && entityType !== 'profile' ? isFavorite(entityType, item.id) : false;
    const canFavorite = Boolean(user && entityType && entityType !== 'profile');

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
        <Image source={getResultImage(item)} style={styles.collageImage} contentFit="cover" cachePolicy="memory-disk" transition={180} />
        {canFavorite && (
          <TouchableOpacity
            style={styles.favButton}
            onPress={(e) => {
              e.stopPropagation();
              handleToggleFavorite(item);
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: fav ? '#E74C3C' : '#FFF', fontSize: 18 }}>{fav ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        )}
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View
        style={[
          styles.searchSection,
          !hasActiveSearch && styles.searchSectionCentered,
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
              contentFit="contain"
            />
          </View>

          <View style={styles.searchContainer}>
            <SearchBar 
              searchQuery={searchQuery} 
              handleSearchChange={handleSearchChange} 
              isActive={isFocused}
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

        {!hasActiveSearch && (
          <View style={styles.discoveryPanel}>
            <Text style={styles.discoveryTitle}>Start digging</Text>
            <Text style={styles.discoveryText}>Search albums, songs, artists, or profiles and build your music map.</Text>
            {recentSearches.length > 0 ? (
              <View style={styles.recentWrap}>
                <Text style={styles.recentTitle}>Recent searches</Text>
                <View style={styles.recentChips}>
                  {recentSearches.map((item) => (
                    <TouchableOpacity key={item} style={styles.recentChip} onPress={() => setSearchQuery(item)}>
                      <Text style={styles.recentChipText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}
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

      {!isLoading && searchResults.length === 0 && normalizedQuery !== '' && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsTitle}>No matches for "{normalizedQuery}"</Text>
          <Text style={styles.noResultsText}>Try another spelling or switch categories.</Text>
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
    marginTop: 22,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  noResultsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  noResultsText: {
    color: '#BDB4CA',
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 8,
  },
  discoveryPanel: {
    marginHorizontal: 20,
    marginTop: 36,
    marginBottom: 16,
    padding: 20,
    borderRadius: 28,
    backgroundColor: '#251F2F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  discoveryTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
  },
  discoveryText: {
    color: '#D8D0E4',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  recentWrap: {
    marginTop: 18,
  },
  recentTitle: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  recentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  recentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(244,231,197,0.12)',
  },
  recentChipText: {
    color: '#F4E7C5',
    fontWeight: '800',
    fontSize: 13,
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
  favButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
