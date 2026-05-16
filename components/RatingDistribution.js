import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { normalizeRatingDistribution } from '../utils/ratingDistribution';

const RATINGS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

const normalizeDistribution = (distribution = {}) => RATINGS.map((rating) => ({
  rating,
  count: Number(normalizeRatingDistribution(distribution)[String(rating)] || 0),
}));

function RatingDistribution({ distribution, total = 0 }) {
  const rows = normalizeDistribution(distribution);
  const maxCount = Math.max(...rows.map((row) => row.count), 1);
  const hasRatings = total > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Rating spread</Text>
        <Text style={styles.subtitle}>{hasRatings ? `${total} ratings` : 'No ratings yet'}</Text>
      </View>
      <View style={styles.rows}>
        {rows.map(({ rating, count }) => {
          const width = hasRatings && count > 0 ? `${Math.max(4, (count / maxCount) * 100)}%` : '0%';
          return (
            <View key={rating} style={styles.row}>
              <Text style={styles.ratingLabel}>{rating}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width }]} />
              </View>
              <Text style={styles.countLabel}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: '#B8B1BF',
    fontSize: 12,
    fontWeight: '700',
  },
  rows: {
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    width: 18,
    color: '#F4E7C5',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  track: {
    flex: 1,
    height: 7,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#A071CA',
  },
  countLabel: {
    width: 22,
    color: '#AFA7B7',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default React.memo(RatingDistribution);
