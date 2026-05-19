import { useEffect, useState } from 'react';

function getEntity(payload, shape) {
  if (!payload) return null;
  return shape === 'artist' ? payload.artist : payload;
}

/**
 * Detail screens mirror React Query into local state for optimistic rating updates.
 * When the route entity id changes on a reused screen instance, clear stale UI state
 * and only apply query payloads that match the current id.
 */
export function useEntityDetailUiState(entityId, query, shape = 'flat') {
  const [entityData, setEntityData] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState({});
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  useEffect(() => {
    setEntityData(null);
    setIsFavorite(false);
    setUserRating(0);
    setAverageRating(0);
    setRatingCount(0);
    setRatingDistribution({});
    setShowReviewPrompt(false);
  }, [entityId]);

  useEffect(() => {
    if (!query.data || !entityId) return;
    const entity = getEntity(query.data, shape);
    if (!entity || String(entity.id) !== String(entityId)) return;

    setEntityData(query.data);
    setAverageRating(entity.averageRating || 0);
    setRatingCount(entity.ratingCount || 0);
    setRatingDistribution(entity.ratingDistribution || {});
    setUserRating(entity.userRating || 0);
    setIsFavorite(Boolean(entity.isFavorite));
  }, [entityId, query.data, shape]);

  const currentEntity = getEntity(entityData, shape);
  const isDetailReady = Boolean(
    currentEntity && entityId && String(currentEntity.id) === String(entityId)
  );

  return {
    entityData,
    setEntityData,
    isFavorite,
    setIsFavorite,
    userRating,
    setUserRating,
    averageRating,
    setAverageRating,
    ratingCount,
    setRatingCount,
    ratingDistribution,
    setRatingDistribution,
    showReviewPrompt,
    setShowReviewPrompt,
    isDetailReady,
  };
}
