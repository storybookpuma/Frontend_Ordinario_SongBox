import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TestGradient = () => (
  <View style={styles.container}>
    <LinearGradient
      colors={['transparent', '#353232']}
      locations={[0.5, 1]}
      start={{ x: 0.5, y: 0.5 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <Text style={styles.text}>Degradado de Prueba</Text>
    </LinearGradient>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gradient: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10
  },
  text: {
    color: '#fff',
    fontSize: 18
  }
});

export default TestGradient;
