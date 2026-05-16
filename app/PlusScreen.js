import React from 'react';
import PlusScreen from '../screens/PlusScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function PlusRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <PlusScreen navigation={navigation} route={route} />;
}
