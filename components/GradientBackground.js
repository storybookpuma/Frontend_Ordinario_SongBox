import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const GradientBackground = ({ colors, locations, start, end, style, children }) => {
  const { width: screenWidth } = useWindowDimensions();

  return (
    <LinearGradient
      colors={colors || ['transparent', '#353232']}
      locations={locations || [0.0, 1]}
      start={start || { x: 0.5, y: 0 }}
      end={end || { x: 0.5, y: 1 }}
      style={[styles.gradient, { width: screenWidth }, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
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
