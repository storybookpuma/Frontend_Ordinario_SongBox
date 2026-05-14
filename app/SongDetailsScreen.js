import React from 'react';
import SongDetailsScreen from '../screens/SongDetailsScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function SongDetailsRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <SongDetailsScreen navigation={navigation} route={route} />;
}
