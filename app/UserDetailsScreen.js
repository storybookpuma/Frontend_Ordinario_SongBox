import React from 'react';
import UserDetailsScreen from '../screens/UserDetailsScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function UserDetailsRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <UserDetailsScreen navigation={navigation} route={route} />;
}
