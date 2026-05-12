import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

const GradientBackground = ({ colors, locations, start, end, style, children }) => {
  return (
    <LinearGradient
      colors={colors || ['transparent', '#353232']}
      locations={locations || [0.0, 1]}
      start={start || { x: 0.5, y: 0 }}
      end={end || { x: 0.5, y: 1 }}
      style={[styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    width: screenWidth,
    height: 228, 
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: 55,
    zIndex: 1,
  },
});

export default GradientBackground;
