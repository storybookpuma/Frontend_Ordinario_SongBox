import React, { useEffect, useRef } from 'react';
import { Animated, View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; 

const SearchBar = ({ searchQuery, handleSearchChange, isActive = true }) => {
  const borderProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) return undefined;

    borderProgress.setValue(0);
    const animation = Animated.timing(borderProgress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [borderProgress, isActive]);

  const horizontalSweep = borderProgress.interpolate({
    inputRange: [0, 0.26],
    outputRange: [-120, 420],
    extrapolate: 'clamp',
  });
  const horizontalSweepReverse = borderProgress.interpolate({
    inputRange: [0.5, 0.76],
    outputRange: [420, -120],
    extrapolate: 'clamp',
  });
  const verticalSweep = borderProgress.interpolate({
    inputRange: [0.25, 0.51],
    outputRange: [-32, 48],
    extrapolate: 'clamp',
  });
  const verticalSweepReverse = borderProgress.interpolate({
    inputRange: [0.74, 1],
    outputRange: [48, -32],
    extrapolate: 'clamp',
  });
  const topOpacity = borderProgress.interpolate({
    inputRange: [0, 0.02, 0.24, 0.26, 1],
    outputRange: [0, 1, 1, 0, 0],
  });
  const rightOpacity = borderProgress.interpolate({
    inputRange: [0, 0.25, 0.27, 0.49, 0.51, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });
  const bottomOpacity = borderProgress.interpolate({
    inputRange: [0, 0.5, 0.52, 0.74, 0.76, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });
  const leftOpacity = borderProgress.interpolate({
    inputRange: [0, 0.75, 0.77, 0.98, 1],
    outputRange: [0, 0, 1, 1, 0],
  });

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.borderLayer}>
        <Animated.View
          style={[styles.borderRunnerTop, { opacity: topOpacity, transform: [{ translateX: horizontalSweep }] }]}
        />
        <Animated.View
          style={[styles.borderRunnerRight, { opacity: rightOpacity, transform: [{ translateY: verticalSweep }] }]}
        />
        <Animated.View
          style={[styles.borderRunnerBottom, { opacity: bottomOpacity, transform: [{ translateX: horizontalSweepReverse }] }]}
        />
        <Animated.View
          style={[styles.borderRunnerLeft, { opacity: leftOpacity, transform: [{ translateY: verticalSweepReverse }] }]}
        />
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="What are you looking for?"
        placeholderTextColor="#B0B0B0"
        accessibilityLabel="Search"
        accessibilityHint="Search albums, songs, profiles, and artists"
        value={searchQuery}
        onChangeText={handleSearchChange}
        keyboardAppearance='dark'
        clearButtonMode="never" 
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity
          onPress={() => handleSearchChange('')}
          style={styles.clearButton}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon name="times-circle" size={20} color="#B0B0B0" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,0,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 10,
    marginBottom: 15,
    overflow: 'hidden',
  },
  borderLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    overflow: 'hidden',
  },
  borderRunnerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 70,
    height: 2,
    backgroundColor: '#7C00FF',
  },
  borderRunnerBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 70,
    height: 2,
    backgroundColor: '#7C00FF',
  },
  borderRunnerRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 2,
    height: 32,
    backgroundColor: '#7C00FF',
  },
  borderRunnerLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 2,
    height: 32,
    backgroundColor: '#7C00FF',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    zIndex: 2,
  },
  clearButton: {
    padding: 5,
    zIndex: 2,
  },
});

export default SearchBar;
