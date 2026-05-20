import React from 'react';
import ArtistReleasesScreen from '../screens/ArtistReleasesScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function ArtistReleasesRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <ArtistReleasesScreen navigation={navigation} route={route} />;
}
