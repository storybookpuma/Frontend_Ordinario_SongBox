import React from 'react';
import { Platform } from 'react-native';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function MainTabsLayout() {
  return (
    <NativeTabs
      tintColor="#BBA7FF"
      minimizeBehavior={Platform.OS === 'ios' ? 'onScrollDown' : undefined}
    >
      <NativeTabs.Trigger name="HomeScreen">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="SearchScreen" role="search">
        <Icon sf="magnifyingglass" md="search" />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ProfileScreen">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
