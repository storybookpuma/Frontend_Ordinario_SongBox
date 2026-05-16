// src/components/CommentSection.js

import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { 
  Alert,
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { SkeletonList } from './Skeleton';
import { queryKeys } from '../api/queryKeys';
import { resolveImageUrl, sortComments } from '../utils/normalizers';
import { useToast } from '../context/ToastContext';

const getCommentsSignature = (commentsList = []) => commentsList.map((comment) => comment._id || comment.id).join('|');

const getRelativeTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!timestamp) return '';

  const diffSeconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return new Date(value).toLocaleDateString();
};

export default function CommentSection({ entityType, entityId, comments = [], onAddComment, showLoadErrorAlert = true }) { 
  const { axiosInstance, user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const queryKey = useMemo(() => queryKeys.comments(entityType, entityId), [entityId, entityType]);
  const lastSyncedSignature = useRef('');

  useEffect(() => {
    const nextSignature = getCommentsSignature(comments);
    if (comments.length > 0 && entityId && nextSignature !== lastSyncedSignature.current) {
      lastSyncedSignature.current = nextSignature;
      queryClient.setQueryData(queryKey, {
        pages: [{ comments, pagination: { page: 1, total_pages: 1 } }],
        pageParams: [1],
      });
    }
  }, [comments, entityId, queryClient, queryKey]);

  const commentsQuery = useInfiniteQuery({
    queryKey,
    enabled: Boolean(user && entityId && axiosInstance),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await axiosInstance.get(`/${entityType}/${entityId}/comments`, {
        params: { page: pageParam, limit: 10 },
      });

      return {
        comments: response.data.comments || [],
        pagination: response.data.pagination || { page: pageParam, total_pages: 1 },
      };
    },
    getNextPageParam: (lastPage) => {
      const page = lastPage.pagination?.page || 1;
      const totalPages = lastPage.pagination?.total_pages || 1;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  const visibleComments = useMemo(() => {
    const queryComments = commentsQuery.data?.pages.flatMap((page) => page.comments || []) || [];
    return sortComments(queryComments);
  }, [commentsQuery.data]);

  useEffect(() => {
    const nextSignature = getCommentsSignature(visibleComments);
    if (visibleComments.length > 0 && nextSignature !== lastSyncedSignature.current) {
      lastSyncedSignature.current = nextSignature;
      onAddComment?.(visibleComments);
    }
  }, [onAddComment, visibleComments]);

  useEffect(() => {
    if (commentsQuery.isError) {
      console.error("Error al obtener los comentarios:", commentsQuery.error?.message);
      if (showLoadErrorAlert) {
        showToast("No se pudieron cargar los comentarios.");
      }
    }
  }, [commentsQuery.error?.message, commentsQuery.isError, showLoadErrorAlert, showToast]);

  const updateCachedComments = (updater) => {
    queryClient.setQueryData(queryKey, (current) => {
      if (!current?.pages) return current;

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          comments: updater(page.comments || []),
        })),
      };
    });
  };

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => axiosInstance.delete(`/${entityType}/${entityId}/comments/${commentId}`),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousComments = queryClient.getQueryData(queryKey);
      updateCachedComments((cachedComments) => cachedComments.filter((comment) => comment._id !== commentId));
      return { previousComments };
    },
    onError: (_error, _commentId, context) => {
      queryClient.setQueryData(queryKey, context?.previousComments);
      showToast("No se pudo eliminar el comentario.");
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ commentId, reaction }) => axiosInstance.post(`/${entityType}/${entityId}/comments/${commentId}/${reaction}`),
    onMutate: async ({ commentId, reaction }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousComments = queryClient.getQueryData(queryKey);
      const userId = user?.id?.toString();

      updateCachedComments((cachedComments) => cachedComments.map((comment) => {
        if (comment._id !== commentId || !userId) return comment;

        const likedBy = Array.isArray(comment.liked_by) ? comment.liked_by : [];
        const dislikedBy = Array.isArray(comment.disliked_by) ? comment.disliked_by : [];
        const isLike = reaction === 'like';
        const hasLiked = likedBy.includes(userId);
        const hasDisliked = dislikedBy.includes(userId);

        if (isLike) {
          return {
            ...comment,
            liked_by: hasLiked ? likedBy.filter((id) => id !== userId) : [...likedBy, userId],
            disliked_by: hasDisliked ? dislikedBy.filter((id) => id !== userId) : dislikedBy,
            likes: Math.max(0, (comment.likes || 0) + (hasLiked ? -1 : 1)),
            dislikes: Math.max(0, (comment.dislikes || 0) - (hasDisliked ? 1 : 0)),
          };
        }

        return {
          ...comment,
          disliked_by: hasDisliked ? dislikedBy.filter((id) => id !== userId) : [...dislikedBy, userId],
          liked_by: hasLiked ? likedBy.filter((id) => id !== userId) : likedBy,
          dislikes: Math.max(0, (comment.dislikes || 0) + (hasDisliked ? -1 : 1)),
          likes: Math.max(0, (comment.likes || 0) - (hasLiked ? 1 : 0)),
        };
      }));

      return { previousComments };
    },
    onSuccess: (response) => {
      const updatedComment = response.data.comment;
      updateCachedComments((cachedComments) => cachedComments.map((comment) => (
        comment._id === updatedComment._id ? updatedComment : comment
      )));
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previousComments);
      showToast("No se pudo actualizar la reacción.");
    },
  });

  const handleLoadMore = () => {
    if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
      commentsQuery.fetchNextPage();
    }
  };

  const handleDeleteComment = async (commentId) => {
    Alert.alert(
      'Eliminar comentario',
      'Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteCommentMutation.mutate(commentId) },
      ]
    );
  };

  const handleLike = async (commentId) => {
    reactionMutation.mutate({ commentId, reaction: 'like' });
  };

  const handleDislike = async (commentId) => {
    reactionMutation.mutate({ commentId, reaction: 'dislike' });
  };

  const isInitialLoading = commentsQuery.isLoading && visibleComments.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Comentarios</Text>
        <Text style={styles.countBadge}>{visibleComments.length}</Text>
      </View>
      <View style={styles.commentsContainer}>
        {isInitialLoading ? (
          <SkeletonList count={3} />
        ) : visibleComments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="comment-o" size={20} color="#F4E7C5" />
            </View>
            <Text style={styles.emptyTitle}>No hay comentarios aun</Text>
            <Text style={styles.noCommentsText}>Se el primero en dejar una opinion.</Text>
          </View>
        ) : (
          visibleComments.map((comment) => {
            const likedBy = Array.isArray(comment.liked_by) ? comment.liked_by : [];
            const dislikedBy = Array.isArray(comment.disliked_by) ? comment.disliked_by : [];

            const hasLiked = user && likedBy.includes(user.id.toString());
            const hasDisliked = user && dislikedBy.includes(user.id.toString());
            const avatarUrl = resolveImageUrl(
              comment.user_photo || comment.profile_picture || comment.user_profile_picture || comment.profilePicture
            );

            return (
              <View key={comment._id} style={styles.commentContainer}>
                <Image
                  source={avatarUrl ? { uri: avatarUrl } : require('../assets/default_picture.png')}
                  style={styles.userPhoto}
                  contentFit="cover"
                />
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.username} numberOfLines={1}>{comment.username || 'SongBox user'}</Text>
                    <Text style={styles.timestamp}>{getRelativeTime(comment.timestamp)}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.comment_text}</Text>
                  <View style={styles.reactionsContainer}>
                    <TouchableOpacity 
                      onPress={() => handleLike(comment._id)} 
                      style={[styles.reactionButton, hasLiked && styles.activeLikeButton]}
                      accessibilityRole="button"
                      accessibilityLabel="Like comment"
                    >
                      <Icon 
                        name={hasLiked ? "heart" : "heart-o"} 
                        size={16} 
                        color={hasLiked ? "#FF8FAB" : "#A9A0B8"} 
                      />
                      <Text style={styles.reactionText}>{comment.likes}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleDislike(comment._id)} 
                      style={[styles.reactionButton, hasDisliked && styles.activeDislikeButton]}
                      accessibilityRole="button"
                      accessibilityLabel="Dislike comment"
                    >
                      <Icon 
                        name={hasDisliked ? "thumbs-down" : "thumbs-o-down"} 
                        size={16} 
                        color={hasDisliked ? "#7AA9FF" : "#A9A0B8"} 
                      />
                      <Text style={styles.reactionText}>{comment.dislikes}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {user && String(user.id) === String(comment.user_id) && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteComment(comment._id)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete comment"
                  >
                    <Icon name="trash-o" size={15} color="#FF8FAB" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
        {commentsQuery.hasNextPage && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
            <Text style={styles.loadMoreText}>{commentsQuery.isFetchingNextPage ? 'Cargando...' : 'Cargar más comentarios'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: '900',
  },
  countBadge: {
    color: '#171515',
    backgroundColor: '#F4E7C5',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
  },
  commentsContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    borderRadius: 24,
    marginBottom: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,231,197,0.12)',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 5,
  },
  noCommentsText: { 
    color: '#A9A0B8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(32,27,39,0.82)',
    padding: 12,
    borderRadius: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userPhoto: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 11,
    backgroundColor: '#2A2532',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    color: '#F4E7C5',
    fontWeight: '900',
    marginBottom: 2,
    flex: 1,
  },
  timestamp: {
    color: '#766E81',
    fontSize: 12,
    fontWeight: '800',
  },
  commentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  activeLikeButton: {
    backgroundColor: 'rgba(255,143,171,0.14)',
  },
  activeDislikeButton: {
    backgroundColor: 'rgba(122,169,255,0.14)',
  },
  reactionText: {
    color: '#D8D0E4',
    fontSize: 12,
    fontWeight: '900',
  },
  deleteButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,143,171,0.1)',
  },
  loadMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(244,231,197,0.1)',
  },
  loadMoreText: {
    color: '#F4E7C5',
    fontWeight: '900',
  },
});
