import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import VideoBackground from '../components/VideoBackground';

export default function Welcome2() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Fondo2.mp4')} />

      {/* Contenido de la pantalla */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Image
            source={require('../assets/Logo.png')}
            style={styles.icon}
          />
          <Text style={styles.appName}>SongBox</Text>
        </View>

        <Text style={styles.title}>Enjoy Listening To Music</Text>
        <Text style={styles.description}>
          Explore a universe of sounds, find new musical gems and share your opinions with other music lovers. Here you can rate and comment on albums, songs, and artists.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={() => navigation.navigate('RegisterScreen')}
          >
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.signInButton} 
            onPress={() => navigation.navigate('SignInScreen')}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  icon: {
    width: 80,
    height: 80,
    marginRight: 10, 
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#CFB7E5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginRight: 10,
  },
  signInButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signInText: {
    color: '#fff',
    fontSize: 18,
  },
});
