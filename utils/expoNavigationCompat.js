import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

const ROUTE_PATHS = {
  Welcome: '/Welcome',
  Welcome2: '/Welcome2',
  RegisterScreen: '/RegisterScreen',
  SignInScreen: '/SignInScreen',
  MainTabs: '/MainTabs/HomeScreen',
  HomeScreen: '/MainTabs/HomeScreen',
  SearchScreen: '/MainTabs/SearchScreen',
  ProfileScreen: '/MainTabs/ProfileScreen',
  AlbumDetailsScreen: '/AlbumDetailsScreen',
  ArtistDetailsScreen: '/ArtistDetailsScreen',
  SongDetailsScreen: '/SongDetailsScreen',
  UserDetailsScreen: '/UserDetailsScreen',
  ChartsScreen: '/ChartsScreen',
  ActivityScreen: '/ActivityScreen',
  WrappedScreen: '/WrappedScreen',
  PlusScreen: '/PlusScreen',
  PublicProfileScreen: '/PublicProfileScreen',
  SettingsScreen: '/SettingsScreen',
};

export const useCompatNavigation = () => {
  const router = useRouter();

  return useMemo(() => ({
    navigate: (name, params) => {
      const pathname = ROUTE_PATHS[name] || `/${name}`;
      router.push({ pathname, params });
    },
    replace: (name, params) => {
      const pathname = ROUTE_PATHS[name] || `/${name}`;
      router.replace({ pathname, params });
    },
    goBack: () => router.back(),
  }), [router]);
};

export const useCompatRoute = () => {
  const params = useLocalSearchParams();
  return useMemo(() => ({ params }), [params]);
};
