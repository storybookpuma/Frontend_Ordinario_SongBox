import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';

const PERKS = [
  { icon: 'photo', title: 'Share Cards', desc: 'Premium templates for stories and posts' },
  { icon: 'bar-chart', title: 'Advanced Wrapped', desc: 'Weekly recaps, yearly wrap, friend comparisons' },
  { icon: 'heart', title: 'Unlimited Compatibility', desc: 'Full taste match with anyone' },
  { icon: 'star', title: 'Rare Badges', desc: 'Unlock epic and legendary badges' },
  { icon: 'paint-brush', title: 'Profile Themes', desc: 'Animated backgrounds and custom colors' },
  { icon: 'link', title: 'Public Profile', desc: 'Share your taste archive with a link' },
];

export default function PlusScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="angle-left" size={28} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.heroAura} />
          <Text style={styles.kicker}>SongBox Plus</Text>
          <Text style={styles.title}>Your music taste, amplified</Text>
          <Text style={styles.subtitle}>Unlock the full archive of your listening identity.</Text>
        </View>

        <View style={styles.perksCard}>
          {PERKS.map((perk) => (
            <View key={perk.title} style={styles.perkRow}>
              <View style={styles.perkIconWrap}>
                <Icon name={perk.icon} size={16} color="#171515" />
              </View>
              <View style={styles.perkInfo}>
                <Text style={styles.perkTitle}>{perk.title}</Text>
                <Text style={styles.perkDesc}>{perk.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cta} activeOpacity={0.88}>
          <Text style={styles.ctaText}>Unlock Plus</Text>
          <Text style={styles.ctaSub}>Coming soon</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.archiveCta} activeOpacity={0.88} onPress={() => navigation.navigate('PremiumInsightsScreen')}>
          <View>
            <Text style={styles.archiveEyebrow}>Spotify Archive</Text>
            <Text style={styles.archiveTitle}>Open Premium Insights</Text>
          </View>
          <Icon name="line-chart" size={18} color="#171515" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 34,
  },
  backButton: {
    marginTop: 8,
    marginBottom: 8,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  hero: {
    paddingVertical: 24,
    paddingHorizontal: 6,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    backgroundColor: 'rgba(32,27,39,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 18,
    gap: 8,
  },
  heroAura: {
    position: 'absolute',
    right: -60,
    top: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(244,231,197,0.18)',
  },
  kicker: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    color: '#D8D0E4',
    fontSize: 14,
    lineHeight: 20,
  },
  perksCard: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(32,27,39,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
    marginBottom: 18,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  perkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4E7C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkInfo: {
    flex: 1,
  },
  perkTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  perkDesc: {
    color: '#A9A0B8',
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    backgroundColor: '#F4E7C5',
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: 'center',
    gap: 2,
  },
  ctaText: {
    color: '#171515',
    fontSize: 17,
    fontWeight: '900',
  },
  ctaSub: {
    color: '#5F4F31',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  archiveCta: {
    marginTop: 12,
    backgroundColor: '#7AE7C7',
    padding: 18,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archiveEyebrow: {
    color: '#245448',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  archiveTitle: {
    color: '#171515',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
});
