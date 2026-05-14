import React from 'react';
import ProfileScreen from '../../screens/ProfileScreen';
import { useCompatNavigation, useCompatRoute } from '../../utils/expoNavigationCompat';

export default function ProfileRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <ProfileScreen navigation={navigation} route={route} />;
}
