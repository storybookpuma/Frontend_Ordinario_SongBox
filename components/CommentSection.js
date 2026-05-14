// src/components/CommentSection.js

import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { 
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
import { sortComments } from '../utils/normalizers';
import { useToast } from '../context/ToastContext';

const getCommentsSignature = (commentsList = []) => commentsList.map((comment) => comment._id || comment.id).join('|');

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
    deleteCommentMutation.mutate(commentId);
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
      <Text style={styles.title}>Comentarios</Text>
      <View style={styles.commentsContainer}>
        {isInitialLoading ? (
          <SkeletonList count={3} />
        ) : visibleComments.length === 0 ? (
          <Text style={styles.noCommentsText}>No hay comentarios aún.</Text>
        ) : (
          visibleComments.map((comment) => {
            const likedBy = Array.isArray(comment.liked_by) ? comment.liked_by : [];
            const dislikedBy = Array.isArray(comment.disliked_by) ? comment.disliked_by : [];

            const hasLiked = user && likedBy.includes(user.id.toString());
            const hasDisliked = user && dislikedBy.includes(user.id.toString());

            // Forzar el uso de default_picture.png para TODOS los comentarios
            // Ignoramos comment.user_photo y siempre usamos default_picture.png
            return (
              <View key={comment._id} style={styles.commentContainer}>
                <Image
                  source={require('../assets/default_picture.png')}
                  style={styles.userPhoto}
                />
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.username}>{comment.username}</Text>
                    <Text style={styles.timestamp}>{new Date(comment.timestamp).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.comment_text}</Text>
                  <View style={styles.reactionsContainer}>
                    {/* Botón de Like */}
                    <TouchableOpacity 
                      onPress={() => handleLike(comment._id)} 
                      style={styles.reactionButton}
                    >
                      <Icon 
                        name={hasLiked ? "heart" : "heart-o"} 
                        size={16} 
                        color={hasLiked ? "#E74C3C" : "#A071CA"} 
                      />
                      <Text style={styles.reactionText}>{comment.likes}</Text>
                    </TouchableOpacity>

                    {/* Botón de Dislike */}
                    <TouchableOpacity 
                      onPress={() => handleDislike(comment._id)} 
                      style={styles.reactionButton}
                    >
                      <Icon 
                        name={hasDisliked ? "thumbs-down" : "thumbs-o-down"} 
                        size={16} 
                        color={hasDisliked ? "#3498DB" : "#A071CA"} 
                      />
                      <Text style={styles.reactionText}>{comment.dislikes}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {user && user.email === comment.user_email && (
                  <TouchableOpacity onPress={() => handleDeleteComment(comment._id)}>
                    <Text style={styles.deleteText}>Eliminar</Text>
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
    marginBottom: 10, // Espacio para el input
  },
  title: {
    fontSize: 18,
    color: '#A071CA',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  commentsContainer: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%', // Asegurar que ocupe todo el ancho
  },
  noCommentsText: { 
    color: '#fff',
    textAlign: 'center',
    marginVertical: 10,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    backgroundColor: '#2c2c2c',
    padding: 10,
    borderRadius: 10,
    width: '100%',
  },
  userPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#555',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  username: {
    color: '#A071CA',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
  },
  commentText: {
    color: '#fff',
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  reactionText: {
    color: '#A071CA',
    marginLeft: 5,
  },
  deleteText: {
    color: 'red',
    marginLeft: 10,
    fontSize: 12,
  },
  loadMoreButton: {
    padding: 10,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#A071CA',
    fontWeight: 'bold',
  },
});
