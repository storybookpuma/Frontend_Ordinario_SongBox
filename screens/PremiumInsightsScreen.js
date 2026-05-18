import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { AuthContext } from '../context/AuthContext';
import { DetailSkeleton } from '../components/Skeleton';
import { usePremiumInsights, usePremiumRecompute, useSpotifyFullSync, useSpotifyImport } from '../hooks/usePremiumInsights';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage } from '../utils/errors';

const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');
const formatHours = (value) => `${formatNumber(Number(value || 0).toFixed(1))}h`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not yet');

export default function PremiumInsightsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const insightsQuery = usePremiumInsights();
  const importMutation = useSpotifyImport();
  const recomputeMutation = usePremiumRecompute();
  const spotifySyncMutation = useSpotifyFullSync();
  const data = insightsQuery.data || {};
  const summary = data.summary || {};
  const profile = data.tasteProfile || {};
  const sync = data.sync || {};
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
      showToast('Archivo importado y Taste Profile recalculado.');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'No se pudo importar el archivo.'));
    }
  };

  const handleSync = async () => {
    try {
      const response = await spotifySyncMutation.mutateAsync(true);
      showToast(response.skipped ? 'Tu sync de Spotify sigue fresco.' : 'Spotify actualizado.');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'No se pudo sincronizar Spotify.'));
    }
  };

  const handleRecompute = async () => {
    try {
      await recomputeMutation.mutateAsync();
      showToast('Taste Profile recalculado.');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'No se pudo recalcular el perfil.'));
    }
  };

  if (insightsQuery.isLoading) return <DetailSkeleton />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="angle-left" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.badge}>
            <Icon name="diamond" size={12} color="#171515" />
            <Text style={styles.badgeText}>Plus Taste</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlowGold} />
          <View style={styles.heroGlowMint} />
          <Text style={styles.kicker}>Taste Identity</Text>
          <Text style={styles.title}>Spotify remembers. SongBox decides.</Text>
          <Text style={styles.subtitle}>Your archive is the memory layer; ratings, reviews, and favorites shape the taste profile that keeps evolving.</Text>
        </View>

        {!isPlus ? <LockedCard /> : !hasImport ? (
          <ImportCard onPress={handlePickFile} isLoading={importMutation.isPending} />
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard label="Total hours" value={formatHours(summary.totalHours)} accent="#F4E7C5" />
              <MetricCard label="Imported plays" value={formatNumber(summary.processedPlays)} accent="#7AE7C7" />
              <MetricCard label="Taste alignment" value={`${profile.songbox_vs_spotify_score?.alignmentPercent || 0}%`} accent="#BBA7FF" />
              <MetricCard label="Core items" value={profile.core_taste_items?.length || 0} accent="#FF8FAB" />
            </View>

            <ControlDeck
              sync={sync}
              onImport={handlePickFile}
              onSync={handleSync}
              onRecompute={handleRecompute}
              importing={importMutation.isPending}
              syncing={spotifySyncMutation.isPending}
              recomputing={recomputeMutation.isPending}
            />

            <SaysCard profile={profile} />
            <InsightCards insights={profile.insights || []} />

            <View style={styles.posterCard}>
              <Text style={styles.sectionEyebrow}>Dominant eras</Text>
              <Text style={styles.sectionTitle}>Years that shaped you</Text>
              {(profile.era_summary?.topYears || summary.topYears || []).slice(0, 6).map((year, index, years) => (
                <View key={year.year} style={styles.yearRow}>
                  <Text style={styles.yearRank}>{index + 1}</Text>
                  <Text style={styles.yearLabel}>{year.year}</Text>
                  <View style={styles.yearBarTrack}>
                    <View style={[styles.yearBarFill, { width: `${Math.max(10, Math.min(100, (year.hours / (years[0]?.hours || 1)) * 100))}%` }]} />
                  </View>
                  <Text style={styles.yearHours}>{formatHours(year.hours)}</Text>
                </View>
              ))}
            </View>

            <RankedSection title="Core Taste" items={profile.core_taste_items || []} renderMeta={(item) => item.reason || item.artist} />
            <RankedSection title="Unrated Obsessions" items={profile.skip_listen_contrast?.unratedObsessions || []} renderMeta={(item) => item.artist} />
            <RankedSection title="Historical top artists" items={profile.historical_top_artists || summary.topArtists || []} renderMeta={(item) => formatHours(item.hours || item.score)} />
            <RankedSection title="Current SongBox orbit" items={profile.current_top_artists || []} renderMeta={(item) => `score ${Number(item.score || 0).toFixed(2)}`} />

            <View style={styles.posterCard}>
              <Text style={styles.sectionEyebrow}>Rating bias</Text>
              <Text style={styles.sectionTitle}>{profile.rating_bias?.label || 'Building signal'}</Text>
              <Text style={styles.bodyText}>Average SongBox rating: {profile.rating_bias?.averageRating || 0} across {profile.rating_bias?.ratingCount || 0} rating signals. Skip sample: {profile.skip_listen_contrast?.skipRateSample || 0}%.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LockedCard() {
  return <View style={styles.posterCard}><Text style={styles.sectionEyebrow}>Locked Plus feature</Text><Text style={styles.sectionTitle}>Import your full Spotify history</Text><Text style={styles.bodyText}>Plus is enabled manually from the database for now. Once enabled, this screen unlocks archive import and living taste profiles.</Text></View>;
}

function ControlDeck({ sync, onImport, onSync, onRecompute, importing, syncing, recomputing }) {
  return (
    <View style={styles.controlDeck}>
      <View style={styles.syncCopy}>
        <Text style={styles.sectionEyebrow}>Refresh status</Text>
        <Text style={styles.syncTitle}>Last sync: {formatDate(sync.lastSpotifySyncAt)}</Text>
        <Text style={styles.syncSub}>Next scheduled heavy sync: {formatDate(sync.nextSpotifySyncAt)}</Text>
      </View>
      <View style={styles.controlRow}>
        <SmallAction title="Replace archive" icon="archive" onPress={onImport} loading={importing} />
        <SmallAction title="Sync now" icon="refresh" onPress={onSync} loading={syncing} />
        <SmallAction title="Recompute" icon="magic" onPress={onRecompute} loading={recomputing} />
      </View>
    </View>
  );
}

function ImportCard({ onPress, isLoading }) {
  return <TouchableOpacity style={styles.importCard} onPress={onPress} disabled={isLoading} activeOpacity={0.88}><View style={styles.importIcon}>{isLoading ? <ActivityIndicator color="#171515" /> : <Icon name="archive" size={20} color="#171515" />}</View><View style={styles.importTextWrap}><Text style={styles.importTitle}>Import Spotify ZIP or JSON</Text><Text style={styles.importText}>Replace mode keeps stats clean and ignores IP addresses.</Text></View></TouchableOpacity>;
}

function SmallAction({ title, icon, onPress, loading }) {
  return <TouchableOpacity style={styles.smallAction} onPress={onPress} disabled={loading} activeOpacity={0.86}>{loading ? <ActivityIndicator color="#171515" /> : <Icon name={icon} size={14} color="#171515" />}<Text style={styles.smallActionText}>{title}</Text></TouchableOpacity>;
}

function MetricCard({ label, value, accent }) {
  return <View style={styles.metricCard}><View style={[styles.metricDot, { backgroundColor: accent }]} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function SaysCard({ profile }) {
  const spotify = profile.historical_top_artists?.[0]?.name || 'Still importing';
  const songbox = profile.current_top_artists?.[0]?.name || 'Keep rating';
  return (
    <View style={styles.saysGrid}>
      <View style={styles.saysCard}><Text style={styles.sectionEyebrow}>Spotify says</Text><Text style={styles.saysName}>{spotify}</Text><Text style={styles.bodyText}>Your long-term listening memory.</Text></View>
      <View style={styles.saysCardAlt}><Text style={styles.sectionEyebrow}>SongBox says</Text><Text style={styles.saysName}>{songbox}</Text><Text style={styles.bodyText}>Your active rating and review identity.</Text></View>
    </View>
  );
}

function InsightCards({ insights }) {
  if (!insights.length) return null;
  return <View style={styles.posterCard}>{insights.map((insight) => <View key={`${insight.title}-${insight.body}`} style={styles.insightRow}><Text style={styles.insightTitle}>{insight.title}</Text><Text style={styles.bodyText}>{insight.body}</Text></View>)}</View>;
}

function RankedSection({ title, items, renderMeta }) {
  if (!items.length) return null;
  return <View style={styles.posterCard}><Text style={styles.sectionTitle}>{title}</Text>{items.slice(0, 8).map((item, index) => <View key={`${title}-${item.spotifyId || item.entityId || item.name}-${index}`} style={styles.rankRow}><Text style={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.rankInfo}><Text style={styles.rankName} numberOfLines={1}>{item.name}</Text><Text style={styles.rankMeta} numberOfLines={1}>{renderMeta(item)}</Text></View>{item.hours ? <Text style={styles.rankHours}>{formatHours(item.hours)}</Text> : null}</View>)}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#171515' },
  content: { paddingHorizontal: 18, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F4E7C5', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  badgeText: { color: '#171515', fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  hero: { minHeight: 230, borderRadius: 34, backgroundColor: '#211C25', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: 22, justifyContent: 'flex-end', gap: 8 },
  heroGlowGold: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(244,231,197,0.22)', top: -60, right: -40 },
  heroGlowMint: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(122,231,199,0.16)', bottom: -70, left: -50 },
  kicker: { color: '#F4E7C5', fontSize: 12, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { color: '#FFF', fontSize: 36, lineHeight: 39, fontWeight: '900' },
  subtitle: { color: '#D8D0E4', fontSize: 14, lineHeight: 20, maxWidth: 330 },
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
  importIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(23,21,21,0.12)', alignItems: 'center', justifyContent: 'center' },
  importTextWrap: { flex: 1 },
  importTitle: { color: '#171515', fontSize: 16, fontWeight: '900' },
  importText: { color: '#5F4F31', fontSize: 12, fontWeight: '700', marginTop: 2 },
  controlDeck: { padding: 16, borderRadius: 28, backgroundColor: 'rgba(244,231,197,0.12)', borderWidth: 1, borderColor: 'rgba(244,231,197,0.20)', gap: 14 },
  syncCopy: { gap: 4 },
  syncTitle: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  syncSub: { color: '#A9A0B8', fontSize: 12, fontWeight: '700' },
  controlRow: { flexDirection: 'row', gap: 8 },
  smallAction: { flex: 1, minHeight: 52, borderRadius: 18, backgroundColor: '#F4E7C5', alignItems: 'center', justifyContent: 'center', gap: 4 },
  smallActionText: { color: '#171515', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  saysGrid: { flexDirection: 'row', gap: 10 },
  saysCard: { flex: 1, padding: 16, borderRadius: 26, backgroundColor: 'rgba(122,231,199,0.12)', borderWidth: 1, borderColor: 'rgba(122,231,199,0.24)', gap: 8 },
  saysCardAlt: { flex: 1, padding: 16, borderRadius: 26, backgroundColor: 'rgba(255,143,171,0.12)', borderWidth: 1, borderColor: 'rgba(255,143,171,0.24)', gap: 8 },
  saysName: { color: '#FFF', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  insightRow: { gap: 5, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  insightTitle: { color: '#F4E7C5', fontSize: 15, fontWeight: '900' },
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
