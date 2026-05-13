import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const TABS = ['HomeScreen', 'SearchScreen', 'ProfileScreen'];

const MenuBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [barWidth, setBarWidth] = useState(0);
  const activeIndexAnim = useRef(new Animated.Value(Math.max(TABS.indexOf(route.name), 0))).current;
  const itemWidth = barWidth > 0 ? (barWidth - 24) / TABS.length : 0;

  useEffect(() => {
    const activeIndex = Math.max(TABS.indexOf(route.name), 0);
    Animated.spring(activeIndexAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      tension: 190,
      friction: 18,
    }).start();
  }, [activeIndexAnim, route.name]);

  // Función para determinar si una pestaña está activa
  const getIconColor = (tab) => (route.name === tab ? '#FFFFFF' : 'rgba(255,255,255,0.72)');
  const navigateToTab = useCallback((tab) => {
    if (route.name !== tab) {
      navigation.navigate(tab);
    }
  }, [navigation, route.name]);

  const navigateFromTouch = useCallback((locationX) => {
    if (!barWidth) return;

    const clampedX = Math.max(12, Math.min(locationX, barWidth - 12));
    const index = Math.max(0, Math.min(Math.floor((clampedX - 12) / itemWidth), TABS.length - 1));
    navigateToTab(TABS[index]);
  }, [barWidth, itemWidth, navigateToTab]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
    onPanResponderGrant: (event) => navigateFromTouch(event.nativeEvent.locationX),
    onPanResponderMove: (event) => navigateFromTouch(event.nativeEvent.locationX),
  }), [navigateFromTouch]);

  const activeTranslateX = activeIndexAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, itemWidth, itemWidth * 2],
  });

  return (
    <View style={styles.menuShell} pointerEvents="box-none" {...panResponder.panHandlers}>
      <BlurView intensity={Platform.OS === 'ios' ? 55 : 35} tint="dark" style={styles.menuBar}>
        <LinearGradient
          colors={['rgba(236,218,255,0.32)', 'rgba(124,58,237,0.22)', 'rgba(37,20,54,0.66)']}
          locations={[0, 0.52, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glassOverlay}
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
          {...panResponder.panHandlers}
        >
          {itemWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.liquidThumb,
                {
                  width: itemWidth,
                  transform: [{ translateX: activeTranslateX }],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.42)', 'rgba(188,119,255,0.30)', 'rgba(255,255,255,0.10)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.95, y: 1 }}
                style={styles.liquidThumbGradient}
              />
            </Animated.View>
          ) : null}
          <Pressable
            style={styles.menuItem}
            onPress={() => navigateToTab('HomeScreen')}
            accessibilityRole="tab"
            accessibilityLabel="Home"
            accessibilityState={{ selected: route.name === 'HomeScreen' }}
          >
            <Icon name="home" size={22} color={getIconColor('HomeScreen')} />
            <Text style={[styles.menuText, { color: getIconColor('HomeScreen') }]}>Home</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => navigateToTab('SearchScreen')}
            accessibilityRole="tab"
            accessibilityLabel="Search"
            accessibilityState={{ selected: route.name === 'SearchScreen' }}
          >
            <Icon name="search" size={22} color={getIconColor('SearchScreen')} />
            <Text style={[styles.menuText, { color: getIconColor('SearchScreen') }]}>Search</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => navigateToTab('ProfileScreen')}
            accessibilityRole="tab"
            accessibilityLabel="Profile"
            accessibilityState={{ selected: route.name === 'ProfileScreen' }}
          >
            <Icon name="user" size={22} color={getIconColor('ProfileScreen')} />
            <Text style={[styles.menuText, { color: getIconColor('ProfileScreen') }]}>Profile</Text>
          </Pressable>
        </LinearGradient>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  menuShell: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: Platform.OS === 'ios' ? 28 : 18,
    zIndex: 999,
    borderRadius: 34,
    shadowColor: '#A071CA',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 18,
  },
  menuBar: {
    height: 72,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(224,197,255,0.36)',
    backgroundColor: 'rgba(47,28,68,0.56)',
  },
  glassOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    position: 'relative',
  },
  liquidThumb: {
    position: 'absolute',
    left: 12,
    top: 9,
    bottom: 9,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    shadowColor: '#D8B4FE',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  liquidThumbGradient: {
    flex: 1,
    backgroundColor: 'rgba(168,85,247,0.22)',
  },
  menuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 54,
    borderRadius: 27,
    zIndex: 2,
  },
  menuText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default MenuBar;
