import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

export default function CoverImage({ source, style, contentFit = 'cover', placeholder = true }) {
  const isValidSource = source && (
    (typeof source === 'number') || 
    (source.uri && source.uri.startsWith('http'))
  );

  if (!isValidSource) {
    return (
      <View style={[style, styles.fallbackContainer]}>
        <Text style={styles.fallbackIcon}>🎵</Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={200}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    fontSize: 28,
    opacity: 0.5,
  },
});
