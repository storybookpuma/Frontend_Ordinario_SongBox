import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import VideoBackground from '../components/VideoBackground';

export default function Welcome2() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Fondo2.mp4')} />
      <View style={styles.scrim} />

      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={require('../assets/Logo.png')} style={styles.icon} contentFit="contain" />
          <View>
            <Text style={styles.appName}>SongBox</Text>
            <Text style={styles.tagline}>Music social diary</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Connect through taste</Text>
          <Text style={styles.title}>See what your friends are really listening to.</Text>
          <View style={styles.featureRow}>
            <Icon name="star" size={14} color="#FFD166" />
            <Text style={styles.featureText}>Rate albums, songs, and artists</Text>
          </View>
          <View style={styles.featureRow}>
            <Icon name="heart" size={14} color="#FF8FAB" />
            <Text style={styles.featureText}>Build your favorites library</Text>
          </View>
          <View style={styles.featureRow}>
            <Icon name="spotify" size={14} color="#7AE7C7" />
            <Text style={styles.featureText}>Link Spotify after signup</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.navigate('RegisterScreen')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Register"
          >
            <Text style={styles.registerText}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => navigation.navigate('SignInScreen')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingBottom: 38,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 58,
    height: 58,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
  },
  tagline: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: {
    padding: 22,
    borderRadius: 30,
    backgroundColor: 'rgba(32,27,39,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 13,
  },
  kicker: {
    color: '#BBA7FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    marginBottom: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: '#D8D0E4',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  registerButton: {
    flex: 1,
    backgroundColor: '#F4E7C5',
    paddingVertical: 17,
    borderRadius: 22,
    alignItems: 'center',
  },
  signInButton: {
    paddingHorizontal: 24,
    paddingVertical: 17,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  registerText: {
    color: '#171515',
    fontSize: 16,
    fontWeight: '900',
  },
  signInText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
