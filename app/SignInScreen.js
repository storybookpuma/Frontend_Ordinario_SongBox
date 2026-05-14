import React from 'react';
import SignInScreen from '../screens/SignInScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function SignInRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <SignInScreen navigation={navigation} route={route} />;
}
