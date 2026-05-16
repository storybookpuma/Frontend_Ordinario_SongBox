import React, { useContext, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SettingsScreen({ navigation }) {
  const { user, logout, axiosInstance, setUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleUnlinkSpotify = () => {
    Alert.alert(
      'Desvincular Spotify',
      'La app conservara tu cuenta, ratings y favoritos, pero las busquedas y metricas de Spotify pueden dejar de funcionar hasta que reconectes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            setIsUnlinking(true);
            try {
              const response = await axiosInstance.post('/unlink_spotify');
              if (response.data.user) setUser(response.data.user);
              showToast(response.data.message || 'Spotify desvinculado.');
            } catch (_error) {
              showToast('No se pudo desvincular Spotify.');
            } finally {
              setIsUnlinking(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="angle-left" size={28} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.kicker}>SongBox</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage account access and connected services.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <View style={styles.accountRow}>
          <View>
            <Text style={styles.username}>{user?.username || 'SongBox user'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spotify</Text>
        <View style={styles.spotifyStatus}>
          <View style={[styles.statusDot, { backgroundColor: user?.spotify_connected ? '#7AE7C7' : '#FF8FAB' }]} />
          <Text style={styles.statusText}>{user?.spotify_connected ? 'Connected' : 'Disconnected'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.dangerButton, (!user?.spotify_connected || isUnlinking) && styles.disabledButton]}
          onPress={handleUnlinkSpotify}
          disabled={!user?.spotify_connected || isUnlinking}
        >
          {isUnlinking ? <ActivityIndicator color="#FF8FAB" /> : <Text style={styles.dangerText}>Unlink Spotify</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Historical metrics</Text>
        <Text style={styles.historyTitle}>Spotify history import</Text>
        <Text style={styles.historyText}>
          Coming soon: import your Spotify extended history to power richer Wrapped, play-count style insights, and long-term taste charts.
        </Text>
        <View style={styles.comingSoonPill}>
          <Text style={styles.comingSoonText}>Coming soon</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Icon name="sign-out" size={16} color="#171515" />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171515',
    paddingHorizontal: 18,
  },
  backButton: {
    marginTop: 8,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  header: {
    marginTop: 20,
    marginBottom: 18,
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
    fontSize: 36,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: '#D8D0E4',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  card: {
    padding: 18,
    borderRadius: 26,
    backgroundColor: 'rgba(32,27,39,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  cardTitle: {
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  email: {
    color: '#A9A0B8',
    fontSize: 13,
    marginTop: 3,
  },
  spotifyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(255,143,171,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,143,171,0.25)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  dangerText: {
    color: '#FF8FAB',
    fontSize: 15,
    fontWeight: '900',
  },
  historyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  historyText: {
    color: '#D8D0E4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  comingSoonPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(187,167,255,0.14)',
  },
  comingSoonText: {
    color: '#BBA7FF',
    fontSize: 12,
    fontWeight: '900',
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 14,
    backgroundColor: '#F4E7C5',
    paddingVertical: 15,
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#171515',
    fontSize: 16,
    fontWeight: '900',
  },
});
