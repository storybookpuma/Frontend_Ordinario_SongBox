import React, { useContext } from 'react';
import { Redirect } from 'expo-router';
import { AuthContext } from '../context/AuthContext';

export default function IndexRoute() {
  const { user } = useContext(AuthContext);
  return <Redirect href={user ? '/MainTabs/HomeScreen' : '/Welcome'} />;
}
