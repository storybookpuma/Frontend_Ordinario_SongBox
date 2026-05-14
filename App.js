import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import AppNavigator from './AppNavigator';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NavigationContainer } from '@react-navigation/native';
import LoadingScreen from './components/LoadingScreen';
import { useContext } from 'react';
import { queryClient, queryPersister, shouldPersistQuery } from './api/queryClient';

const PRELOADED_ASSETS = [
  require('./assets/Logo.png'),
  require('./assets/default_picture.png'),
];

export default function App() {
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
      <NavigationContainer>
        <ToastProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <Main />
          </AuthProvider>
        </ToastProvider>
      </NavigationContainer>
    </PersistQueryClientProvider>
  );
}

const Main = () => {
  const { isLoading } = useContext(AuthContext);
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

  if (isLoading || !assetsReady) {
    return <LoadingScreen />;
  }

  return <AppNavigator />;
};
