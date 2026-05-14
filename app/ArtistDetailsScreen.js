import React from 'react';
import ArtistDetailsScreen from '../screens/ArtistDetailsScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function ArtistDetailsRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <ArtistDetailsScreen navigation={navigation} route={route} />;
}
