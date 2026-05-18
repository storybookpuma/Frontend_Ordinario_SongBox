import React, { useContext, useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Sentry from '@sentry/react-native';
import LoadingScreen from '../components/LoadingScreen';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { queryClient, queryPersister, shouldPersistQuery } from '../api/queryClient';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});

const PRELOADED_ASSETS = [
  require('../assets/Logo.png'),
  require('../assets/default_picture.png'),
];

const AppStack = () => {
  const { user, isLoading } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments();
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Asset.loadAsync(PRELOADED_ASSETS).finally(() => {
      if (isMounted) {
        setAssetsReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading || !assetsReady) {
      return;
    }

    const firstSegment = segments[0];
    const isAuthRoute = !firstSegment || ['Welcome', 'Welcome2', 'RegisterScreen', 'SignInScreen'].includes(firstSegment);

    if (user && isAuthRoute) {
      router.replace('/MainTabs/HomeScreen');
      return;
    }

    if (!user && !isAuthRoute) {
      router.replace('/Welcome');
    }
  }, [assetsReady, isLoading, router, segments, user]);

  if (isLoading || !assetsReady) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171515' } }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="MainTabs" options={{ animation: 'none' }} />
        <Stack.Screen name="Welcome" />
        <Stack.Screen name="Welcome2" />
        <Stack.Screen name="RegisterScreen" />
        <Stack.Screen name="SignInScreen" />
        <Stack.Screen name="AlbumDetailsScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ArtistDetailsScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="SongDetailsScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="UserDetailsScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ChartsScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ActivityScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="WrappedScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PlusScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PublicProfileScreen" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="SettingsScreen" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
};

function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 12,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
    >
      <ToastProvider>
        <AuthProvider>
          <ThemeProvider value={DarkTheme}>
            <AppStack />
          </ThemeProvider>
        </AuthProvider>
      </ToastProvider>
    </PersistQueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
