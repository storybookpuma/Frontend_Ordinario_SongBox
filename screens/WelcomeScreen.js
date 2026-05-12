import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import VideoBackground from '../components/VideoBackground';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Fondo1.mp4')} />

      <View style={styles.overlay}>
        {/* Icono */}
        <Image
          source={require('../assets/Logo.png')}
          style={styles.icon}
        />

        {/* Texto de bienvenida */}
        <Text style={styles.title}>Enjoy Listening To Music</Text>
        <Text style={styles.description}>
          Explore a universe of sounds, find new musical gems and share your opinions with other music lovers. Here you can rate and comment on albums, songs, and artists.
        </Text>

        {/* Botón para navegar a Welcome2 */}
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Welcome2')}>
          <Text style={styles.buttonText}>Get started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  icon: {
    width: 80,
    height: 80,
    marginBottom: 20,
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
  button: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
