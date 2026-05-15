import React from 'react';
import WrappedScreen from '../screens/WrappedScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function WrappedRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <WrappedScreen navigation={navigation} route={route} />;
}
