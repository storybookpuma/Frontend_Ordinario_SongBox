import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const MenuBar = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Función para determinar si una pestaña está activa
  const getIconColor = (tab) => (route.name === tab ? '#A071CA' : '#fff');
  const navigateToTab = (tab) => {
    if (route.name !== tab) {
      navigation.navigate(tab);
    }
  };

  return (
    <LinearGradient
      colors={['rgba(23, 21, 21, 0)', '#171515']} 
      locations={[0.0, 1]} 
      start={{ x: 0.5, y: 0 }} 
      end={{ x: 0.5, y: 1 }}   
      style={styles.menuBar}
    >
      <Pressable
        style={styles.menuItem}
        onPress={() => navigateToTab('HomeScreen')}
      >
        <Icon
          name="home"
          size={24}
          color={getIconColor('HomeScreen')}
        />
        <Text style={[styles.menuText, { color: getIconColor('HomeScreen') }]}>Home</Text>
      </Pressable>
      
      <Pressable
        style={styles.menuItem}
        onPress={() => navigateToTab('SearchScreen')}
      >
        <Icon
          name="search"
          size={24}
          color={getIconColor('SearchScreen')}
        />
        <Text style={[styles.menuText, { color: getIconColor('SearchScreen') }]}>Search</Text>
      </Pressable>
      
      <Pressable
        style={styles.menuItem}
        onPress={() => navigateToTab('ProfileScreen')}
      >
        <Icon
          name="user"
          size={24}
          color={getIconColor('ProfileScreen')}
        />
        <Text style={[styles.menuText, { color: getIconColor('ProfileScreen') }]}>Profile</Text>
      </Pressable>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  menuBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 20,
    borderTopWidth: 0, 
    zIndex: 999, 
  },
  menuItem: {
    alignItems: 'center',
  },
  menuText: {
    fontSize: 12,
    marginTop: 5,
  },
});

export default MenuBar;
