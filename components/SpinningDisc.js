import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const SpinningDisc = ({ source, size = 56, isPlaying = false }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation;
    if (isPlaying) {
      animation = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      rotation.stopAnimation();
      rotation.setValue(0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isPlaying, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const holeSize = size * 0.2;
  const holeRadius = holeSize / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ rotate: spin }],
          },
        ]}
      >
        <View style={styles.imageWrap}>
          <Image
            source={source}
            style={{ width: size, height: size }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
        <View
          style={[
            styles.centerHole,
            {
              width: holeSize,
              height: holeSize,
              borderRadius: holeRadius,
              top: (size - holeSize) / 2,
              left: (size - holeSize) / 2,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  disc: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
    overflow: 'hidden',
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  centerHole: {
    position: 'absolute',
    backgroundColor: '#171515',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});

export default React.memo(SpinningDisc);
