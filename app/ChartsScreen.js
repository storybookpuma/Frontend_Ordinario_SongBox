import React from 'react';
import ChartsScreen from '../screens/ChartsScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function ChartsRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <ChartsScreen navigation={navigation} route={route} />;
}
