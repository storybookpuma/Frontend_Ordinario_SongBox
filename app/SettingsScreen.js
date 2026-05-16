import React from 'react';
import SettingsScreen from '../screens/SettingsScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function SettingsRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <SettingsScreen navigation={navigation} route={route} />;
}
