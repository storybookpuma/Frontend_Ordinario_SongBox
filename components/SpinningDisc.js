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
        <Image
          source={source}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View
          style={[
            styles.centerHole,
            {
              width: size * 0.22,
              height: size * 0.22,
              borderRadius: size * 0.11,
              top: '50%',
              left: '50%',
              marginTop: -(size * 0.11),
              marginLeft: -(size * 0.11),
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
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  centerHole: {
    position: 'absolute',
    backgroundColor: '#171515',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

export default React.memo(SpinningDisc);
