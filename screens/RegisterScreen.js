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

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { register, isLoading: authIsLoading } = useContext(AuthContext);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleRegister = async () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Por favor, completa todos los campos.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Creando cuenta...');
    try {
      await register(username, email, password);
      setStatusMessage('Completa la conexión con Spotify para continuar.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Ocurrió un error al registrarse.');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Register.mp4')} />

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
        <Text style={styles.title}>Register</Text>

        <TextInput
          placeholder="Enter Username"
          placeholderTextColor="#FFF"
          style={styles.input}
          keyboardAppearance="dark"
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          value={username}
          onChangeText={setUsername}
        />

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
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          placeholder="Confirm Password"
          placeholderTextColor="#FFF"
          secureTextEntry
          style={styles.input}
          keyboardAppearance="dark"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
          disabled={isLoading || authIsLoading}
        >
          {isLoading || authIsLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.registerButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
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
  registerButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  registerButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#D8C7FF',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  spotifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  spotifyText: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
