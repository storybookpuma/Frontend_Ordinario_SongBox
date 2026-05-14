import React from 'react';
import HomeScreen from '../../screens/HomeScreen';
import { useCompatNavigation, useCompatRoute } from '../../utils/expoNavigationCompat';

export default function HomeRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <HomeScreen navigation={navigation} route={route} />;
}
