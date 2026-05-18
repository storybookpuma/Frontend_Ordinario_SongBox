import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { usePremiumInsights, useSpotifyImport } from '../hooks/usePremiumInsights';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage } from '../utils/errors';

const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');
const formatHours = (value) => `${formatNumber(Number(value || 0).toFixed(1))}h`;

export default function PremiumInsightsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const insightsQuery = usePremiumInsights();
  const importMutation = useSpotifyImport();
  const data = insightsQuery.data || {};
  const summary = data.summary || {};
  const isPlus = user?.is_plus || data.isPlus;
  const hasImport = Boolean(data.hasImport);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/json'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await importMutation.mutateAsync(result.assets[0]);
      showToast('Tu archivo de Spotify fue importado.');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'No se pudo importar el archivo.'));
    }
  };

  if (insightsQuery.isLoading) {
    return <DetailSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="angle-left" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.badge}>
            <Icon name="diamond" size={12} color="#171515" />
            <Text style={styles.badgeText}>Plus Archive</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlowGold} />
          <View style={styles.heroGlowMint} />
          <Text style={styles.kicker}>Spotify archive</Text>
          <Text style={styles.title}>Your listening life, decoded</Text>
          <Text style={styles.subtitle}>A side quest for power listeners. Ratings and reviews stay at the center; this reveals the history behind them.</Text>
        </View>

        {!isPlus ? (
          <LockedCard />
        ) : !hasImport ? (
          <ImportCard onPress={handlePickFile} isLoading={importMutation.isPending} />
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard label="Total hours" value={formatHours(summary.totalHours)} accent="#F4E7C5" />
              <MetricCard label="Imported plays" value={formatNumber(summary.processedPlays)} accent="#7AE7C7" />
              <MetricCard label="Active years" value={summary.activeYears || 0} accent="#BBA7FF" />
              <MetricCard label="SongBox overlap" value={data.songboxContrast?.ratedImportedSongs || 0} accent="#FF8FAB" />
            </View>

            <ImportCard onPress={handlePickFile} isLoading={importMutation.isPending} compact />

            <View style={styles.posterCard}>
              <Text style={styles.sectionEyebrow}>Dominant eras</Text>
              <Text style={styles.sectionTitle}>Years that shaped you</Text>
              {(summary.topYears || []).slice(0, 6).map((year, index) => (
                <View key={year.year} style={styles.yearRow}>
                  <Text style={styles.yearRank}>{index + 1}</Text>
                  <Text style={styles.yearLabel}>{year.year}</Text>
                  <View style={styles.yearBarTrack}>
                    <View style={[styles.yearBarFill, { width: `${Math.max(10, Math.min(100, (year.hours / ((summary.topYears || [])[0]?.hours || 1)) * 100))}%` }]} />
                  </View>
                  <Text style={styles.yearHours}>{formatHours(year.hours)}</Text>
                </View>
              ))}
            </View>

            <RankedSection title="Obsession tracks" items={summary.topTracks || []} renderMeta={(item) => item.artist} />
            <RankedSection title="Artists in orbit" items={summary.topArtists || []} renderMeta={(item) => formatHours(item.hours)} />
            <RankedSection title="Album eras" items={summary.topAlbums || []} renderMeta={(item) => item.artist} />

            <View style={styles.posterCard}>
              <Text style={styles.sectionEyebrow}>Spotify vs SongBox</Text>
              <Text style={styles.sectionTitle}>The contrast layer</Text>
              <Text style={styles.bodyText}>We sampled {formatNumber(data.songboxContrast?.importedSongsSample)} imported tracks and found {formatNumber(data.songboxContrast?.ratedImportedSongs)} that also appear in your SongBox rating graph.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LockedCard() {
  return (
    <View style={styles.posterCard}>
      <Text style={styles.sectionEyebrow}>Locked Plus feature</Text>
      <Text style={styles.sectionTitle}>Import your full Spotify history</Text>
      <Text style={styles.bodyText}>Plus is currently enabled manually from the database. Once enabled, this screen unlocks ZIP/JSON import and historical dashboards.</Text>
    </View>
  );
}

function ImportCard({ onPress, isLoading, compact = false }) {
  return (
    <TouchableOpacity style={[styles.importCard, compact && styles.importCardCompact]} onPress={onPress} disabled={isLoading} activeOpacity={0.88}>
      <View style={styles.importIcon}>
        {isLoading ? <ActivityIndicator color="#171515" /> : <Icon name="archive" size={20} color="#171515" />}
      </View>
      <View style={styles.importTextWrap}>
        <Text style={styles.importTitle}>{compact ? 'Import another archive' : 'Import Spotify ZIP or JSON'}</Text>
        <Text style={styles.importText}>Extended Streaming History only. IP addresses are ignored.</Text>
      </View>
    </TouchableOpacity>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricDot, { backgroundColor: accent }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function RankedSection({ title, items, renderMeta }) {
  if (!items.length) return null;
  return (
    <View style={styles.posterCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.slice(0, 8).map((item, index) => (
        <View key={`${title}-${item.spotifyId || item.name}-${index}`} style={styles.rankRow}>
          <Text style={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={styles.rankInfo}>
            <Text style={styles.rankName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rankMeta} numberOfLines={1}>{renderMeta(item)}</Text>
          </View>
          {item.hours ? <Text style={styles.rankHours}>{formatHours(item.hours)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#171515' },
  content: { paddingHorizontal: 18, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F4E7C5', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  badgeText: { color: '#171515', fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  hero: { minHeight: 220, borderRadius: 34, backgroundColor: '#211C25', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: 22, justifyContent: 'flex-end', gap: 8 },
  heroGlowGold: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(244,231,197,0.22)', top: -60, right: -40 },
  heroGlowMint: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(122,231,199,0.16)', bottom: -70, left: -50 },
  kicker: { color: '#F4E7C5', fontSize: 12, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { color: '#FFF', fontSize: 38, lineHeight: 40, fontWeight: '900' },
  subtitle: { color: '#D8D0E4', fontSize: 14, lineHeight: 20, maxWidth: 320 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', padding: 16, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', gap: 8 },
  metricDot: { width: 10, height: 10, borderRadius: 5 },
  metricValue: { color: '#FFF', fontSize: 25, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { color: '#A9A0B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  posterCard: { padding: 18, borderRadius: 28, backgroundColor: 'rgba(32,27,39,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', gap: 12 },
  sectionEyebrow: { color: '#7AE7C7', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  bodyText: { color: '#CFC7DA', fontSize: 14, lineHeight: 20 },
  importCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 28, backgroundColor: '#F4E7C5' },
  importCardCompact: { backgroundColor: 'rgba(244,231,197,0.14)', borderWidth: 1, borderColor: 'rgba(244,231,197,0.24)' },
  importIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(23,21,21,0.12)', alignItems: 'center', justifyContent: 'center' },
  importTextWrap: { flex: 1 },
  importTitle: { color: '#171515', fontSize: 16, fontWeight: '900' },
  importText: { color: '#5F4F31', fontSize: 12, fontWeight: '700', marginTop: 2 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearRank: { color: '#F4E7C5', width: 18, fontWeight: '900' },
  yearLabel: { color: '#FFF', width: 44, fontWeight: '900' },
  yearBarTrack: { flex: 1, height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  yearBarFill: { height: 9, borderRadius: 999, backgroundColor: '#F4E7C5' },
  yearHours: { color: '#A9A0B8', width: 58, textAlign: 'right', fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rankNumber: { color: '#F4E7C5', width: 28, fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  rankInfo: { flex: 1 },
  rankName: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  rankMeta: { color: '#A9A0B8', fontSize: 12, marginTop: 2 },
  rankHours: { color: '#7AE7C7', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
