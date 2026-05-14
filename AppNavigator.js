import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import WelcomeScreen from './screens/WelcomeScreen';
import Welcome2 from './screens/Welcome2';
import RegisterScreen from './screens/RegisterScreen';
import SignInScreen from './screens/SignInScreen';
import HomeScreen from './screens/HomeScreen';
import AlbumDetailsScreen from './screens/AlbumDetailsScreen';
import ArtistDetailsScreen from './screens/ArtistDetailsScreen';
import SearchScreen from './screens/SearchScreen';
import ProfileScreen from './screens/ProfileScreen';
import SongDetailsScreen from './screens/SongDetailsScreen';
import { AuthContext } from './context/AuthContext';
import UserDetailsScreen from './screens/UserDetailsScreen';
import ChartsScreen from './screens/ChartsScreen';
import ActivityScreen from './screens/ActivityScreen';
import MenuBar from './components/MenuBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const mainScreenOptions = {
  animation: 'none',
};

const detailScreenOptions = {
  animation: 'slide_from_right',
};

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <MenuBar tabBarProps={props} />}
    screenOptions={{
      headerShown: false,
      lazy: false,
    }}
  >
    <Tab.Screen name="HomeScreen" component={HomeScreen} />
    <Tab.Screen name="SearchScreen" component={SearchScreen} />
    <Tab.Screen name="ProfileScreen" component={ProfileScreen} />
  </Tab.Navigator>
);

export default function AppNavigator() {
  const { user } = useContext(AuthContext);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} options={mainScreenOptions} />
          <Stack.Screen name="AlbumDetailsScreen" component={AlbumDetailsScreen} options={detailScreenOptions} />
          <Stack.Screen name="ArtistDetailsScreen" component={ArtistDetailsScreen} options={detailScreenOptions} />
          <Stack.Screen name="SongDetailsScreen" component={SongDetailsScreen} options={detailScreenOptions} />
          <Stack.Screen name="UserDetailsScreen" component={UserDetailsScreen} options={detailScreenOptions} />
          <Stack.Screen name="ChartsScreen" component={ChartsScreen} options={detailScreenOptions} />
          <Stack.Screen name="ActivityScreen" component={ActivityScreen} options={detailScreenOptions} />
        </>
      ) : (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Welcome2" component={Welcome2} />
          <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
          <Stack.Screen name="SignInScreen" component={SignInScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
