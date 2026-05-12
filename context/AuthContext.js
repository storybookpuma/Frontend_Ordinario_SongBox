import React, { createContext, useState, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert, Linking } from 'react-native';
import { createApiClient } from '../api/client';
import { API_BASE_URL } from '../config/env';

export const AuthContext = createContext();

const TOKEN_STORAGE_KEY = 'userToken';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [authCompleted, setAuthCompleted] = useState(false); 

  const axiosInstance = useMemo(() => createApiClient(authToken), [authToken]);

  // Función para iniciar sesión
  const login = async (email, password) => {
    try {
      const response = await axiosInstance.post('/login', {
        email,
        password,
      });
      const { user: userData } = response.data;

      const authSpotifyUrl = `${API_BASE_URL}/auth/spotify?state=${encodeURIComponent(userData.email)}`;
      await Linking.openURL(authSpotifyUrl);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al iniciar sesión');
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

      const authSpotifyUrl = `${API_BASE_URL}/auth/spotify?state=${encodeURIComponent(userData.email)}`;
      await Linking.openURL(authSpotifyUrl);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al registrar usuario');
    }
  };

  // Función para cerrar sesión
  const logout = async () => {
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
  }, []);

  // Manejar el deep link de redirección desde el backend
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const url = event.url;
   
      // Extraer el token del deep link
      const token = extractTokenFromUrl(url);
      if (token) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
        setAuthToken(token);
   
        try {
          const response = await createApiClient(token).get('/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(response.data.user);
          setAuthCompleted(true);
        } catch {
          await logout();
        }
      }
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
  }, []);
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
  const regex = /token=([^&]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};
