import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const StarRating = ({ maxStars = 10, currentRating = 0, onRatingChange, editable = true }) => {
  const [selectedRating, setSelectedRating] = useState(currentRating);

  useEffect(() => {
    setSelectedRating(currentRating);
  }, [currentRating]);

  const handlePress = (rating) => {
    if (!editable) return;
    const newRating = rating === selectedRating ? 0 : rating;
    setSelectedRating(newRating);
    onRatingChange(newRating);
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, index) => {
        const starNumber = index + 1;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => handlePress(starNumber)}
            disabled={!editable}
          >
            <Icon
              name={starNumber <= selectedRating ? 'star' : 'star-o'}
              size={24}
              color="#FFD700"
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
  },
  star: {
    marginHorizontal: 2,
  },
});

export default StarRating;
