import React, { useState, useContext } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { AuthContext } from '../context/AuthContext';
import VideoBackground from '../components/VideoBackground';

export default function SignInScreen() {
  const navigation = useNavigation();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [formError, setFormError] = useState('');

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError('Completa email y password para continuar.');
      return;
    }

    setIsLoading(true);
    setFormError('');
    setStatusMessage('Verificando credenciales...');
    try {
      await login(trimmedEmail, password);
      setStatusMessage('Conecta Spotify cuando se abra el navegador. Volveras aqui automaticamente.');
    } catch (error) {
      setFormError(error.message || 'No pudimos iniciar sesion. Revisa tus datos.');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Login.mp4')} />
      <View style={styles.scrim} />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Icon name="angle-left" size={30} color="#FFF" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formContainer}
      >
        <View style={styles.card}>
          <Text style={styles.kicker}>Welcome back</Text>
          <Text style={styles.title}>Sign in to SongBox</Text>
          <Text style={styles.subtitle}>Pick up your ratings, favorites, and music friends.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.input}
              keyboardAppearance="dark"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Email"
              returnKeyType="next"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setFormError('');
              }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordField}>
              <TextInput
                placeholder="Your password"
                placeholderTextColor="rgba(255,255,255,0.45)"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                keyboardAppearance="dark"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                accessibilityLabel="Password"
                returnKeyType="done"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFormError('');
                }}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eye-slash' : 'eye'} size={17} color="#F4E7C5" />
              </TouchableOpacity>
            </View>
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.signInButton, isLoading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color="#171515" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAuthButton}
            onPress={() => navigation.navigate('RegisterScreen')}
            accessibilityRole="link"
            accessibilityLabel="Create an account"
          >
            <Text style={styles.switchAuthText}>New here? <Text style={styles.switchAuthAccent}>Create an account</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  backButton: {
    position: 'absolute',
    top: 52,
    left: 22,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 34,
  },
  card: {
    padding: 22,
    borderRadius: 32,
    backgroundColor: 'rgba(32,27,39,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 12,
  },
  kicker: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  subtitle: {
    color: '#D8D0E4',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    fontSize: 16,
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  passwordInput: {
    flex: 1,
    color: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: {
    color: '#FF8FAB',
    fontSize: 13,
    lineHeight: 18,
  },
  statusText: {
    color: '#BBA7FF',
    fontSize: 13,
    lineHeight: 18,
  },
  signInButton: {
    backgroundColor: '#F4E7C5',
    paddingVertical: 16,
    borderRadius: 19,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.72,
  },
  signInButtonText: {
    color: '#171515',
    fontSize: 16,
    fontWeight: '900',
  },
  switchAuthButton: {
    alignItems: 'center',
    paddingTop: 2,
  },
  switchAuthText: {
    color: '#D8D0E4',
    fontSize: 14,
    fontWeight: '700',
  },
  switchAuthAccent: {
    color: '#F4E7C5',
    fontWeight: '900',
  },
});
