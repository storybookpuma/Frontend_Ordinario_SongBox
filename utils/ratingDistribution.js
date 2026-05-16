export const emptyRatingDistribution = () => Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => [String(index + 1), 0])
);

export const normalizeRatingDistribution = (distribution = {}) => {
  const normalized = emptyRatingDistribution();

  Object.entries(distribution || {}).forEach(([rating, count]) => {
    const key = String(Math.round(Number(rating)));
    if (key in normalized) {
      normalized[key] += Number(count) || 0;
    }
  });

  return normalized;
};

export const applyRatingDistributionChange = (distribution = {}, previousRating = 0, nextRating = 0) => {
  const next = normalizeRatingDistribution(distribution);
  const prevKey = previousRating ? String(Math.round(previousRating)) : null;
  const nextKey = nextRating ? String(Math.round(nextRating)) : null;

  if (prevKey && next[prevKey] > 0) {
    next[prevKey] -= 1;
  }
  if (nextKey) {
    next[nextKey] = (next[nextKey] || 0) + 1;
  }

  return next;
};

export const hasRatingDistribution = (distribution) => Boolean(
  distribution && Object.values(normalizeRatingDistribution(distribution)).some((value) => Number(value) > 0)
);

export const distributionWithUserFallback = (distribution, userRating = 0) => {
  if (hasRatingDistribution(distribution)) {
    return normalizeRatingDistribution(distribution);
  }

  if (userRating > 0) {
    return applyRatingDistributionChange({}, 0, userRating);
  }

  return normalizeRatingDistribution(distribution);
};
