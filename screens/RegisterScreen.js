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

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { register, isLoading: authIsLoading } = useContext(AuthContext);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [formError, setFormError] = useState('');

  const handleRegister = async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      setFormError('Completa todos los campos para crear tu cuenta.');
      return;
    }

    if (password.length < 6) {
      setFormError('Tu password debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Las contrasenas no coinciden.');
      return;
    }

    setIsLoading(true);
    setFormError('');
    setStatusMessage('Creando cuenta...');
    try {
      await register(trimmedUsername, trimmedEmail, password);
      setStatusMessage('Cuenta creada. Conecta Spotify cuando se abra el navegador.');
    } catch (error) {
      setFormError(error.message || 'No pudimos crear la cuenta. Intenta de nuevo.');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = isLoading || authIsLoading;

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Register.mp4')} />
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
          <Text style={styles.kicker}>Start your archive</Text>
          <Text style={styles.title}>Create your SongBox</Text>
          <Text style={styles.subtitle}>Rate music, save favorites, and compare taste with friends.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              placeholder="Your display name"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.input}
              keyboardAppearance="dark"
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              accessibilityLabel="Username"
              returnKeyType="next"
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                setFormError('');
              }}
            />
          </View>

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
                placeholder="At least 6 characters"
                placeholderTextColor="rgba(255,255,255,0.45)"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                keyboardAppearance="dark"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                accessibilityLabel="Password"
                returnKeyType="next"
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

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              placeholder="Repeat password"
              placeholderTextColor="rgba(255,255,255,0.45)"
              secureTextEntry={!showPassword}
              style={styles.input}
              keyboardAppearance="dark"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              accessibilityLabel="Confirm password"
              returnKeyType="done"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setFormError('');
              }}
            />
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.registerButton, disabled && styles.disabledButton]}
            onPress={handleRegister}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityState={{ disabled }}
          >
            {disabled ? (
              <ActivityIndicator color="#171515" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAuthButton}
            onPress={() => navigation.navigate('SignInScreen')}
            accessibilityRole="link"
            accessibilityLabel="Sign in"
          >
            <Text style={styles.switchAuthText}>Already have an account? <Text style={styles.switchAuthAccent}>Sign in</Text></Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    paddingBottom: 24,
  },
  card: {
    padding: 22,
    borderRadius: 32,
    backgroundColor: 'rgba(32,27,39,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 11,
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
    marginBottom: 2,
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
    paddingVertical: 13,
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
    paddingVertical: 13,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
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
  registerButton: {
    backgroundColor: '#F4E7C5',
    paddingVertical: 16,
    borderRadius: 19,
    alignItems: 'center',
    marginTop: 3,
  },
  disabledButton: {
    opacity: 0.72,
  },
  registerButtonText: {
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
