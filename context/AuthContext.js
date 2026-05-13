import React, { createContext, useCallback, useState, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking } from 'react-native';
import { createApiClient } from '../api/client';
import { API_BASE_URL } from '../config/env';

WebBrowser.maybeCompleteAuthSession();

export const AuthContext = createContext();

const TOKEN_STORAGE_KEY = 'userToken';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [authCompleted, setAuthCompleted] = useState(false); 

  const axiosInstance = useMemo(() => createApiClient(authToken), [authToken]);

  // Función para cerrar sesión
  const logout = useCallback(async () => {
    try {
      setUser(null);
      setAuthToken(null);
      setAuthCompleted(false);
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('Error en logout:', error);
      Alert.alert('Error', 'Ocurrió un error al cerrar sesión.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeSpotifyAuthFromUrl = useCallback(async (url) => {
    const token = extractTokenFromUrl(url);
    if (!token) {
      return false;
    }

    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
    setAuthToken(token);

    try {
      const response = await createApiClient(token).get('/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data.user);
      setAuthCompleted(true);
      return true;
    } catch {
      await logout();
      return false;
    }
  }, [logout]);

  const openSpotifyAuth = async (email) => {
    const returnUrl = ExpoLinking.createURL('login');
    const authSpotifyUrl = `${API_BASE_URL}/auth/spotify?state=${encodeURIComponent(email)}&return_url=${encodeURIComponent(returnUrl)}`;
    const result = await WebBrowser.openAuthSessionAsync(authSpotifyUrl, returnUrl);

    if (result.type === 'success') {
      const completed = await completeSpotifyAuthFromUrl(result.url);
      if (!completed) {
        throw new Error('No se recibió el token de Spotify. Intenta iniciar sesión de nuevo.');
      }
      return;
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('Se canceló la conexión con Spotify.');
    }
  };

  // Función para iniciar sesión
  const login = async (email, password) => {
    try {
      const response = await axiosInstance.post('/login', {
        email,
        password,
      });
      const { user: userData } = response.data;

      await openSpotifyAuth(userData.email);
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Error al iniciar sesión');
    }
  };

  // Función para registrar un nuevo usuario
  const register = async (username, email, password) => {
    try {
      const response = await axiosInstance.post('/register', {
        username,
        email,
        password,
      });
      const { user: userData } = response.data;

      await openSpotifyAuth(userData.email);
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || 'Error al registrar usuario');
    }
  };

  // Cargar el token almacenado al iniciar la app
  useEffect(() => {
    const loadStoredToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);

        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        setAuthToken(storedToken);

        try {
          const response = await createApiClient(storedToken).get('/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          setUser(response.data.user);
          setAuthCompleted(true); // Indicar que la autenticación se completó
        } catch {
          await logout();
        }
      } catch {
        Alert.alert('Error', 'No se pudo cargar la sesión guardada.');
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredToken();
  }, [logout]);

  // Manejar el deep link de redirección desde el backend
  useEffect(() => {
    const handleDeepLink = async (event) => {
      await completeSpotifyAuthFromUrl(event.url);
    };
  
    // Suscribirse al evento de deep linking
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);
  
    // Verificar si la aplicación se abrió con un enlace
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });
  
    // Limpiar la suscripción al desmontar el componente
    return () => {
      linkingSubscription.remove();
    };
  }, [completeSpotifyAuthFromUrl]);
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isLoading,
        axiosInstance,
        setUser,
        authCompleted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Función para extraer el token del URL
const extractTokenFromUrl = (url) => {
  const regex = /[?#&]token=([^&]+)/;
  const match = url.match(regex);
  return match ? decodeURIComponent(match[1]) : null;
};
