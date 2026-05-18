import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,
      gcTime: 1000 * 60 * 20,
      retry: (failureCount, error) => {
        if (error?.response?.status === 401 || error?.response?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'songbox-react-query-cache',
});

export const clearUserScopedQueryCache = async () => {
  queryClient.clear();
  await queryPersister.removeClient();

  const storageKeys = await AsyncStorage.getAllKeys();
  const userScopedKeys = storageKeys.filter((key) => key.startsWith('homeSpotifyFeed:v2'));
  if (userScopedKeys.length > 0) {
    await AsyncStorage.multiRemove(userScopedKeys);
  }
};

export const shouldPersistQuery = (query) => {
  const [scope] = query.queryKey;
  return ['homeFeed', 'favorites', 'albumDetails', 'artistDetails', 'songDetails', 'profileDetails', 'userRating', 'premiumInsights'].includes(scope);
};
