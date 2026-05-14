import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const BASE_COLOR = '#242124';
const HIGHLIGHT_COLOR = '#343038';

export const SkeletonBlock = ({ style }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        style,
        {
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.58, 1],
          }),
        },
      ]}
    />
  );
};

export const SkeletonText = ({ lines = 2, style }) => (
  <View style={[styles.textGroup, style]}>
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonBlock
        key={index}
        style={[
          styles.textLine,
          { width: index === lines - 1 ? '62%' : '88%' },
        ]}
      />
    ))}
  </View>
);

export const SkeletonCard = ({ style, imageStyle }) => (
  <View style={[styles.card, style]}>
    <SkeletonBlock style={[styles.cardImage, imageStyle]} />
    <SkeletonText lines={2} style={styles.cardText} />
  </View>
);

export const SkeletonList = ({ count = 4, itemStyle }) => (
  <View style={styles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <View key={index} style={[styles.listItem, itemStyle]}>
        <SkeletonBlock style={styles.avatar} />
        <SkeletonText lines={2} style={styles.listText} />
      </View>
    ))}
  </View>
);

export const DetailSkeleton = () => (
  <View style={styles.detailContainer}>
    <SkeletonBlock style={styles.hero} />
    <View style={styles.detailContent}>
      <SkeletonBlock style={styles.title} />
      <SkeletonText lines={3} />
      <View style={styles.row}>
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} style={styles.ratingDot} />
        ))}
      </View>
      <SkeletonList count={5} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  block: {
    backgroundColor: BASE_COLOR,
    borderColor: HIGHLIGHT_COLOR,
    borderWidth: 1,
    overflow: 'hidden',
  },
  textGroup: {
    gap: 8,
  },
  textLine: {
    height: 12,
    borderRadius: 6,
  },
  card: {
    padding: 12,
    borderRadius: 22,
    backgroundColor: '#211f21',
    gap: 12,
  },
  cardImage: {
    height: 140,
    borderRadius: 18,
  },
  cardText: {
    paddingHorizontal: 2,
  },
  list: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#211f21',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  listText: {
    flex: 1,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#171515',
  },
  hero: {
    height: 330,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  detailContent: {
    padding: 20,
    gap: 16,
  },
  title: {
    width: '70%',
    height: 28,
    borderRadius: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
