import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './AppNavigator';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import LoadingScreen from './components/LoadingScreen';
import { useContext } from 'react';

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

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <AppNavigator />;
};
