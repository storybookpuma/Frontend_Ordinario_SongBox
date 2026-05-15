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
};

const encodeParams = (params = {}) => Object.fromEntries(
  Object.entries(params).map(([key, value]) => [
    key,
    typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
  ])
);

const decodeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(decodeValue);
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const decodeParams = (params = {}) => Object.fromEntries(
  Object.entries(params).map(([key, value]) => [key, decodeValue(value)])
);

export const useCompatNavigation = () => {
  const router = useRouter();

  return useMemo(() => ({
    navigate: (name, params) => {
      const pathname = ROUTE_PATHS[name] || `/${name}`;
      router.push({ pathname, params: encodeParams(params) });
    },
    replace: (name, params) => {
      const pathname = ROUTE_PATHS[name] || `/${name}`;
      router.replace({ pathname, params: encodeParams(params) });
    },
    goBack: () => router.back(),
  }), [router]);
};

export const useCompatRoute = () => {
  const params = useLocalSearchParams();
  return useMemo(() => ({ params: decodeParams(params) }), [params]);
};
