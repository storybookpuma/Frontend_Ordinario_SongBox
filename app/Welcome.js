import React from 'react';
import WelcomeScreen from '../screens/WelcomeScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function WelcomeRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <WelcomeScreen navigation={navigation} route={route} />;
}
