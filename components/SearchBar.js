import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; 

const SearchBar = ({ searchQuery, handleSearchChange }) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="What are you looking for?"
        placeholderTextColor="#B0B0B0"
        value={searchQuery}
        onChangeText={handleSearchChange}
        keyboardAppearance='dark'
        clearButtonMode="never" 
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => handleSearchChange('')} style={styles.clearButton}>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 10,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  clearButton: {
    padding: 5,
  },
});

export default SearchBar;
