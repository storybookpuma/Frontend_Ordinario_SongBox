import React from 'react';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function PublicProfileRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <PublicProfileScreen navigation={navigation} route={route} />;
}
