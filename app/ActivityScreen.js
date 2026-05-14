import React from 'react';
import ActivityScreen from '../screens/ActivityScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function ActivityRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <ActivityScreen navigation={navigation} route={route} />;
}
