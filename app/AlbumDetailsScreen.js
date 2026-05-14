import React from 'react';
import AlbumDetailsScreen from '../screens/AlbumDetailsScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function AlbumDetailsRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <AlbumDetailsScreen navigation={navigation} route={route} />;
}
