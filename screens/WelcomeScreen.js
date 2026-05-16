import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import VideoBackground from '../components/VideoBackground';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <VideoBackground source={require('../assets/Fondo1.mp4')} />
      <View style={styles.scrim} />

      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Image source={require('../assets/Logo.png')} style={styles.icon} contentFit="contain" />
        </View>

        <View style={styles.copyCard}>
          <Text style={styles.kicker}>Your music taste, archived</Text>
          <Text style={styles.title}>Rate it. Save it. Compare it.</Text>
          <Text style={styles.description}>
            Build a living profile of the albums, songs, and artists that define your month.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Welcome2')}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.buttonText}>Get started</Text>
        </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingBottom: 42,
    gap: 18,
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  icon: {
    width: 58,
    height: 58,
  },
  copyCard: {
    padding: 22,
    borderRadius: 30,
    backgroundColor: 'rgba(32,27,39,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 9,
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
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 41,
  },
  description: {
    color: '#D8D0E4',
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#F4E7C5',
    paddingVertical: 17,
    borderRadius: 22,
    alignItems: 'center',
  },
  buttonText: {
    color: '#171515',
    fontSize: 17,
    fontWeight: '900',
  },
});
