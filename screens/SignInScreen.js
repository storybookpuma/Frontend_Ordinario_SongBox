// screens/SignInScreen.js

import React, { useState, useContext } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import VideoBackground from '../components/VideoBackground';

export default function SignInScreen() {
  const navigation = useNavigation();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor, completa todos los campos.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Verificando credenciales...');
    try {
      await login(email, password);
      setStatusMessage('Completa la conexión con Spotify para continuar.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Ocurrió un error al iniciar sesión.');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Login.mp4')} />

      {/* Botón de regreso */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>{"<"}</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formContainer}
      >
        <Text style={styles.title}>Sign In</Text>

        <TextInput
          placeholder="Enter Email"
          placeholderTextColor="#FFF"
          style={styles.input}
          keyboardAppearance="dark"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#FFF"
          secureTextEntry
          style={styles.input}
          keyboardAppearance="dark"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.signInButton} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.signInButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        {/* Enlace para registrarse */}
        <TouchableOpacity onPress={() => navigation.navigate('RegisterScreen')}>
          <Text style={styles.registerText}>¿No tienes una cuenta? Regístrate</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 24,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  title: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  signInButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  signInButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  statusText: {
    color: '#D8C7FF',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
});
