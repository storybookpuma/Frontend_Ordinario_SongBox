import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const StarRating = ({ maxStars = 10, currentRating = 0, onRatingChange, editable = true, isLoading = false }) => {
  const [selectedRating, setSelectedRating] = useState(currentRating);

  useEffect(() => {
    setSelectedRating(currentRating);
  }, [currentRating]);

  const handlePress = (rating) => {
    if (!editable || isLoading) return;
    const newRating = rating === selectedRating ? 0 : rating;
    setSelectedRating(newRating);
    onRatingChange(newRating);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#A071CA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, index) => {
        const starNumber = index + 1;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => handlePress(starNumber)}
            disabled={!editable || isLoading}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${starNumber} out of ${maxStars}`}
            accessibilityState={{ selected: starNumber === selectedRating, disabled: !editable || isLoading }}
          >
            <Icon
              name={starNumber <= selectedRating ? 'star' : 'star-o'}
              size={24}
              color={editable ? '#FFD700' : '#555'}
              style={styles.star}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
  },
  star: {
    marginHorizontal: 2,
  },
});

export default StarRating;
