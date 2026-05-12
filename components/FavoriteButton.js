// FavoriteButton.js

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const FavoriteButton = ({ isFavorite, onToggleFavorite }) => {
  return (
    <TouchableOpacity onPress={onToggleFavorite} style={styles.favoriteButton}>
      <Icon 
        name={isFavorite ? "heart" : "heart-o"} 
        size={30} // Tamaño ajustado 
        color={isFavorite ? "#A071CA" : "#FFF"} 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  favoriteButton: {
    marginLeft: 10,
  },
});

export default FavoriteButton;
