import React from 'react';
import SearchScreen from '../../screens/SearchScreen';
import { useCompatNavigation, useCompatRoute } from '../../utils/expoNavigationCompat';

export default function SearchRoute() {
  const navigation = useCompatNavigation();
  const route = useCompatRoute();
  return <SearchScreen navigation={navigation} route={route} />;
}
