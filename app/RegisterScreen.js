import React from 'react';
import RegisterScreen from '../screens/RegisterScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function RegisterRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <RegisterScreen navigation={navigation} route={route} />;
}
