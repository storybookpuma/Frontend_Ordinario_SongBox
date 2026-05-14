import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import AppNavigator from './AppNavigator';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import LoadingScreen from './components/LoadingScreen';
import { useContext } from 'react';

const PRELOADED_ASSETS = [
  require('./assets/Logo.png'),
  require('./assets/default_picture.png'),
];

export default function App() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <StatusBar style="light" />
        <Main />
      </AuthProvider>
    </NavigationContainer>
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
