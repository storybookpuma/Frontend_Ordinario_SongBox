import React from 'react';
import { Platform } from 'react-native';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function MainTabsLayout() {
  return (
    <NativeTabs
      tintColor="#BBA7FF"
      backgroundColor="#171515"
      blurEffect="none"
      shadowColor="transparent"
      disableTransparentOnScrollEdge
      minimizeBehavior={Platform.OS === 'ios' ? 'onScrollDown' : undefined}
    >
      <NativeTabs.Trigger name="HomeScreen" disableAutomaticContentInsets>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="SearchScreen" role="search" disableAutomaticContentInsets>
        <Icon sf="magnifyingglass" md="search" />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ProfileScreen" disableAutomaticContentInsets>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
