import React from 'react';
import Welcome2 from '../screens/Welcome2';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function Welcome2Route() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <Welcome2 navigation={navigation} route={route} />;
}
