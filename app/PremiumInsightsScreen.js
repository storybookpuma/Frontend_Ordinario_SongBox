import React from 'react';
import PremiumInsightsScreen from '../screens/PremiumInsightsScreen';
import { useCompatNavigation, useCompatRoute } from '../utils/expoNavigationCompat';

export default function PremiumInsightsRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <PremiumInsightsScreen navigation={navigation} route={route} />;
}
