import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';

const TABS = ['HomeScreen', 'SearchScreen', 'ProfileScreen'];

const MenuBar = ({ scrollY, tabBarProps }) => {
  const fallbackNavigation = useNavigation();
  const route = useRoute();
  const navigation = tabBarProps?.navigation || fallbackNavigation;
  const activeRouteName = tabBarProps
    ? tabBarProps.state.routes[tabBarProps.state.index]?.name
    : route.name;
  const [barWidth, setBarWidth] = useState(0);
  const activeIndexAnim = useRef(new Animated.Value(Math.max(TABS.indexOf(activeRouteName), 0))).current;
  const thumbPulseAnim = useRef(new Animated.Value(0)).current;
  const itemWidth = barWidth > 0 ? (barWidth - 24) / TABS.length : 0;
  const canUseLiquidGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  useEffect(() => {
    const activeIndex = Math.max(TABS.indexOf(activeRouteName), 0);
    thumbPulseAnim.setValue(0);

    Animated.parallel([
      Animated.spring(activeIndexAnim, {
        toValue: activeIndex,
        useNativeDriver: true,
        stiffness: 210,
        damping: 24,
        mass: 0.85,
        overshootClamping: false,
      }),
      Animated.sequence([
        Animated.timing(thumbPulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(thumbPulseAnim, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 180,
          damping: 17,
          mass: 0.8,
        }),
      ]),
    ]).start();
  }, [activeIndexAnim, activeRouteName, thumbPulseAnim]);

  // Función para determinar si una pestaña está activa
  const getIconColor = (tab) => (activeRouteName === tab ? '#FFFFFF' : 'rgba(255,255,255,0.72)');
  const navigateToTab = useCallback((tab) => {
    if (activeRouteName === tab) {
      return;
    }

    if (tabBarProps) {
      const targetRoute = tabBarProps.state.routes.find((item) => item.name === tab);
      const event = navigation.emit({
        type: 'tabPress',
        target: targetRoute?.key,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate(tab);
      }
      return;
    }

    navigation.navigate(tab);
  }, [activeRouteName, navigation, tabBarProps]);

  const getTouchProgress = useCallback((locationX) => {
    if (!barWidth || !itemWidth) return 0;

    const clampedX = Math.max(12, Math.min(locationX, barWidth - 12));
    const centeredX = clampedX - 12 - (itemWidth / 2);
    return Math.max(0, Math.min(centeredX / itemWidth, TABS.length - 1));
  }, [barWidth, itemWidth]);

  const settleToNearestTab = useCallback((locationX) => {
    const progress = getTouchProgress(locationX);
    const index = Math.max(0, Math.min(Math.round(progress), TABS.length - 1));

    Animated.spring(activeIndexAnim, {
      toValue: index,
      useNativeDriver: true,
      stiffness: 210,
      damping: 24,
      mass: 0.85,
    }).start();

    navigateToTab(TABS[index]);
  }, [activeIndexAnim, getTouchProgress, navigateToTab]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
    onPanResponderGrant: (event) => {
      activeIndexAnim.stopAnimation();
      activeIndexAnim.setValue(getTouchProgress(event.nativeEvent.locationX));
    },
    onPanResponderMove: (event) => {
      activeIndexAnim.setValue(getTouchProgress(event.nativeEvent.locationX));
    },
    onPanResponderRelease: (event) => settleToNearestTab(event.nativeEvent.locationX),
    onPanResponderTerminate: () => {
      const activeIndex = Math.max(TABS.indexOf(activeRouteName), 0);
      Animated.spring(activeIndexAnim, {
        toValue: activeIndex,
        useNativeDriver: true,
        stiffness: 210,
        damping: 24,
        mass: 0.85,
      }).start();
    },
  }), [activeIndexAnim, activeRouteName, getTouchProgress, settleToNearestTab]);

  const activeTranslateX = activeIndexAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, itemWidth, itemWidth * 2],
  });

  const thumbScaleX = thumbPulseAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 1.18, 0.96],
  });

  const thumbScaleY = thumbPulseAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 0.94, 1.05],
  });

  const thumbGlowOpacity = thumbPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.5],
  });

  const getTabAnimatedStyle = (tabIndex) => {
    const inputRange = TABS.map((_, index) => index);
    return {
      opacity: activeIndexAnim.interpolate({
        inputRange,
        outputRange: inputRange.map((index) => (index === tabIndex ? 1 : 0.68)),
        extrapolate: 'clamp',
      }),
    };
  };

  const scrollDrivenStyle = scrollY ? {
    opacity: scrollY.interpolate({
      inputRange: [0, 140],
      outputRange: [0.92, 0.72],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, 140],
          outputRange: [0, 18],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: scrollY.interpolate({
          inputRange: [0, 140],
          outputRange: [1, 0.9],
          extrapolate: 'clamp',
        }),
      },
    ],
  } : null;

  return (
    <Animated.View style={[styles.menuShell, scrollDrivenStyle]} pointerEvents="box-none" {...panResponder.panHandlers}>
      <BlurView intensity={Platform.OS === 'ios' ? 55 : 35} tint="dark" style={styles.menuBar}>
        {canUseLiquidGlass ? (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="clear"
            colorScheme="dark"
            isInteractive
            style={styles.nativeGlassLayer}
          />
        ) : null}
        <LinearGradient
          colors={canUseLiquidGlass
            ? ['rgba(255,255,255,0.10)', 'rgba(124,58,237,0.06)', 'rgba(8,8,12,0.10)']
            : ['rgba(236,218,255,0.18)', 'rgba(124,58,237,0.12)', 'rgba(37,20,54,0.34)']}
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
                  transform: [
                    { translateX: activeTranslateX },
                    { scaleX: thumbScaleX },
                    { scaleY: thumbScaleY },
                  ],
                },
              ]}
            >
              <Animated.View style={[styles.liquidGlow, { opacity: thumbGlowOpacity }]} />
              <LinearGradient
                colors={['rgba(255,255,255,0.56)', 'rgba(163,95,255,0.36)', 'rgba(255,255,255,0.12)']}
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
            accessibilityState={{ selected: activeRouteName === 'HomeScreen' }}
          >
            <Animated.View style={[styles.menuItemContent, getTabAnimatedStyle(0)]}>
              <Icon name="home" size={23} color={getIconColor('HomeScreen')} />
              <Text style={[styles.menuText, { color: getIconColor('HomeScreen') }]}>Home</Text>
            </Animated.View>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => navigateToTab('SearchScreen')}
            accessibilityRole="tab"
            accessibilityLabel="Search"
            accessibilityState={{ selected: activeRouteName === 'SearchScreen' }}
          >
            <Animated.View style={[styles.menuItemContent, getTabAnimatedStyle(1)]}>
              <Icon name="search" size={23} color={getIconColor('SearchScreen')} />
              <Text style={[styles.menuText, { color: getIconColor('SearchScreen') }]}>Search</Text>
            </Animated.View>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => navigateToTab('ProfileScreen')}
            accessibilityRole="tab"
            accessibilityLabel="Profile"
            accessibilityState={{ selected: activeRouteName === 'ProfileScreen' }}
          >
            <Animated.View style={[styles.menuItemContent, getTabAnimatedStyle(2)]}>
              <Icon name="user" size={23} color={getIconColor('ProfileScreen')} />
              <Text style={[styles.menuText, { color: getIconColor('ProfileScreen') }]}>Profile</Text>
            </Animated.View>
          </Pressable>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  menuShell: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: Platform.OS === 'ios' ? 12 : 8,
    zIndex: 999,
    borderRadius: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  menuBar: {
    height: 74,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(224,197,255,0.18)',
    backgroundColor: 'rgba(18,14,24,0.28)',
  },
  nativeGlassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
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
    top: 8,
    bottom: 8,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#A071CA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  liquidGlow: {
    position: 'absolute',
    left: -16,
    right: -16,
    top: -12,
    bottom: -12,
    borderRadius: 40,
    backgroundColor: 'rgba(190,124,255,0.2)',
  },
  liquidThumbGradient: {
    flex: 1,
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  menuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    borderRadius: 27,
    zIndex: 2,
  },
  menuItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    paddingTop: 2,
  },
  menuText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default MenuBar;
