import React, { useState, useEffect, useContext, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Keyboard,
  Modal,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { queryKeys } from '../api/queryKeys';
import { resolveImageUrl } from '../utils/normalizers';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

const StarRatingMini = ({ rating }) => {
  if (!rating || rating === 0) return null;
  return (
    <View style={styles.starRow}>
      <Icon name="star" size={11} color="#FFD700" />
      <Text style={styles.starText}>{rating}</Text>
    </View>
  );
};

function CommentRow({ comment, userId, onLike, onReply, onDelete, currentUserRating, isReply = false }) {
  const [liked, setLiked] = useState(Boolean(userId && comment.liked_by?.includes(userId)));
  const [localLikes, setLocalLikes] = useState(comment.likes || 0);
  const isOwner = userId && String(comment.user_id) === String(userId);
  const avatarUrl = resolveImageUrl(comment.user_photo);
  const displayRating = isOwner && currentUserRating > 0 ? currentUserRating : comment.author_rating;

  useEffect(() => {
    setLiked(Boolean(userId && comment.liked_by?.includes(userId)));
    setLocalLikes(comment.likes || 0);
  }, [comment.liked_by, comment.likes, userId]);

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLocalLikes((prev) => prev + (newLiked ? 1 : -1));
    onLike(comment._id);
  };

  return (
    <View style={[styles.commentContainer, isReply && styles.replyContainer]}>
      <Image
        source={avatarUrl ? { uri: avatarUrl } : require('../assets/default_picture.png')}
        style={[styles.avatar, isReply && styles.replyAvatar]}
        contentFit="cover"
      />
      <View style={styles.commentBody}>
        <View style={styles.commentHeaderRow}>
          <Text style={[styles.username, isReply && styles.replyUsername]} numberOfLines={1}>{comment.username || 'SongBox user'}</Text>
          <StarRatingMini rating={displayRating} />
          <Text style={[styles.timestamp, isReply && styles.replyTimestamp]}>{getRelativeTime(comment.timestamp)}</Text>
        </View>
        <Text style={[styles.commentText, isReply && styles.replyText]}>{comment.comment_text}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton} hitSlop={8}>
            <Icon name={liked ? 'heart' : 'heart-o'} size={12} color={liked ? '#FF8FAB' : '#A9A0B8'} />
            <Text style={[styles.actionText, liked && { color: '#FF8FAB' }]}>{localLikes > 0 ? localLikes : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply(comment)} style={styles.actionButton} hitSlop={8}>
            <Icon name="reply" size={11} color="#A9A0B8" />
            <Text style={styles.actionText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isOwner && (
        <TouchableOpacity onPress={() => onDelete(comment._id)} style={styles.deleteBtn} hitSlop={8}>
          <Icon name="trash-o" size={12} color="#FF8FAB" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const CommentSection = forwardRef(function CommentSection({ entityType, entityId, userRating }, ref) {
  const { axiosInstance, user } = useContext(AuthContext);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [replyData, setReplyData] = useState({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const queryKey = queryKeys.comments(entityType, entityId);

  const commentsQuery = useInfiniteQuery({
    queryKey,
    enabled: Boolean(user && entityId && axiosInstance && modalVisible),
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

  const comments = commentsQuery.data?.pages.flatMap((page) => page.comments || []) || [];

  const postMutation = useMutation({
    mutationFn: ({ text, parentId }) => {
      const payload = { comment_text: text };
      if (parentId) payload.parent_id = parentId;
      return axiosInstance.post(`/${entityType}/${entityId}/comments`, payload);
    },
    onSuccess: (response, variables) => {
      const createdComment = {
        ...(response.data.comment || {}),
        author_rating: response.data.comment?.author_rating || userRating || 0,
        reply_count: response.data.comment?.reply_count || 0,
      };
      setCommentText('');
      setReplyingTo(null);
      Keyboard.dismiss();
      if (variables.parentId) {
        setReplyData((current) => ({
          ...current,
          [variables.parentId]: [...(current[variables.parentId] || []), createdComment],
        }));
        setExpandedReplies((current) => ({ ...current, [variables.parentId]: true }));
        queryClient.setQueryData(queryKey, (current) => {
          if (!current?.pages) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              comments: (page.comments || []).map((comment) => (
                comment._id === variables.parentId
                  ? { ...comment, reply_count: (comment.reply_count || 0) + 1 }
                  : comment
              )),
            })),
          };
        });
        return;
      }
      queryClient.setQueryData(queryKey, (current) => {
        if (!current?.pages?.length) return current;
        return {
          ...current,
          pages: current.pages.map((page, index) => index === 0 ? {
            ...page,
            comments: [createdComment, ...(page.comments || [])],
            pagination: {
              ...page.pagination,
              total_comments: (page.pagination?.total_comments || 0) + 1,
            },
          } : page),
        };
      });
    },
    onError: (error) => {
      console.error('Error posting comment:', error?.response?.data || error?.message || error);
      showToast('No se pudo agregar el comentario.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId) => axiosInstance.delete(`/${entityType}/${entityId}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      showToast('No se pudo eliminar el comentario.');
    },
  });

  const likeMutation = useMutation({
    mutationFn: (commentId) => axiosInstance.post(`/${entityType}/${entityId}/comments/${commentId}/like`),
    onError: () => {
      showToast('No se pudo actualizar el like.');
    },
  });

  const openModal = useCallback(() => {
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      friction: 9,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  useImperativeHandle(ref, () => ({ open: openModal }), [openModal]);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setReplyingTo(null);
      setExpandedReplies({});
      setReplyData({});
    });
  };

  useEffect(() => {
    if (!modalVisible) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [modalVisible]);



  useEffect(() => {
    if (replyingTo && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [replyingTo]);

  const handlePost = () => {
    const text = commentText.trim();
    if (!text) {
      showToast('El comentario no puede estar vacío.');
      return;
    }
    postMutation.mutate({ text, parentId: replyingTo?._id });
  };

  const handleLike = (commentId) => {
    likeMutation.mutate(commentId);
  };

  const handleDelete = (commentId) => {
    Alert.alert('Eliminar comentario', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(commentId) },
    ]);
  };

  const handleReply = (comment) => {
    setReplyingTo(comment);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    Keyboard.dismiss();
  };

  const toggleReplies = async (commentId) => {
    if (expandedReplies[commentId]) {
      setExpandedReplies((prev) => ({ ...prev, [commentId]: false }));
      return;
    }
    if (!replyData[commentId]) {
      try {
        const response = await axiosInstance.get(`/${entityType}/${entityId}/comments/${commentId}/replies`);
        setReplyData((prev) => ({ ...prev, [commentId]: response.data.replies || [] }));
      } catch {
        showToast('No se pudieron cargar las respuestas.');
        return;
      }
    }
    setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
  };

  const count = commentsQuery.data?.pages?.[0]?.pagination?.total_comments ?? 0;
  const isInitialLoading = commentsQuery.isLoading;

  return (
    <>
      <TouchableOpacity style={styles.discussionButton} onPress={openModal} activeOpacity={0.8}>
        <View style={styles.discussionIconWrap}>
          <Icon name="comments" size={16} color="#F4E7C5" />
        </View>
        <View style={styles.discussionTextWrap}>
          <Text style={styles.discussionTitle}>Reseñas</Text>
          <Text style={styles.discussionSub}>
            {count > 0 ? `${count} ${count === 1 ? 'reseña' : 'reseñas'}` : 'Sin reseñas aún'}
          </Text>
        </View>
        <Icon name="chevron-up" size={14} color="#A071CA" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.sheet, keyboardHeight > 0 && { paddingBottom: 0 }, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.handleBar} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Reseñas</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={12}>
                <Icon name="times" size={18} color="#A9A0B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
            {isInitialLoading && comments.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="comment-o" size={28} color="#F4E7C5" />
                <Text style={styles.emptyTitle}>Loading...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="comment-o" size={28} color="#F4E7C5" />
                <Text style={styles.emptyTitle}>Sin reseñas aún</Text>
                <Text style={styles.emptySub}>Sé el primero en compartir tu opinión.</Text>
              </View>
            ) : (
              <FlatList
                style={{ flex: 1 }}
                data={comments}
                keyExtractor={(item) => item._id}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={[styles.listContent, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 20 }]}
                renderItem={({ item }) => (
                  <View>
                    <CommentRow
                      comment={item}
                      userId={user?.id}
                      onLike={handleLike}
                      onReply={handleReply}
                      onDelete={handleDelete}
                      currentUserRating={userRating}
                    />
                    {item.reply_count > 0 && !expandedReplies[item._id] && (
                      <TouchableOpacity
                        style={styles.viewRepliesBtn}
                        onPress={() => toggleReplies(item._id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.threadDot} />
                        <Text style={styles.viewRepliesText}>
                          {item.reply_count === 1 ? 'Ver 1 respuesta' : `Ver ${item.reply_count} respuestas`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {expandedReplies[item._id] && (
                      <View style={styles.repliesContainer}>
                        {(replyData[item._id] || []).map((reply) => (
                          <CommentRow
                            key={reply._id}
                            comment={reply}
                            userId={user?.id}
                            onLike={handleLike}
                            onReply={handleReply}
                            onDelete={handleDelete}
                            currentUserRating={userRating}
                            isReply
                          />
                        ))}
                        <TouchableOpacity
                          style={styles.hideRepliesBtn}
                          onPress={() => toggleReplies(item._id)}
                          activeOpacity={0.7}
                        >
                          <Icon name="chevron-up" size={10} color="#A071CA" />
                          <Text style={styles.viewRepliesText}>Ocultar respuestas</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                onEndReached={() => {
                  if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
                    commentsQuery.fetchNextPage();
                  }
                }}
                onEndReachedThreshold={0.3}
                ListFooterComponent={commentsQuery.isFetchingNextPage ? (
                  <Text style={styles.loadingMore}>Loading more...</Text>
                ) : null}
              />
            )}
            </View>

            {replyingTo && (
              <View style={styles.replyingBar}>
                <Text style={styles.replyingText} numberOfLines={1}>
                  Respondiendo a @{replyingTo.username}
                </Text>
                <TouchableOpacity onPress={cancelReply} hitSlop={8}>
                  <Icon name="times" size={14} color="#A071CA" />
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.inputBar, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 8 }]}>
              <Image
                source={
                  user?.profile_picture
                    ? { uri: resolveImageUrl(user.profile_picture) }
                    : require('../assets/default_picture.png')
                }
                style={styles.inputAvatar}
                contentFit="cover"
              />
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={replyingTo ? 'Escribe una respuesta...' : 'Agrega una reseña...'}
                placeholderTextColor="#888"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
                onPress={handlePost}
                disabled={!commentText.trim() || postMutation.isPending}
                activeOpacity={0.7}
              >
                <Icon name="paper-plane" size={14} color={commentText.trim() ? '#FFF' : '#555'} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
});

export default CommentSection;

const styles = StyleSheet.create({
  discussionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 26,
    backgroundColor: 'rgba(160,113,202,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(160,113,202,0.2)',
    gap: 14,
  },
  discussionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(244,231,197,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionTextWrap: {
    flex: 1,
  },
  discussionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  discussionSub: {
    fontSize: 13,
    color: '#A9A0B8',
    marginTop: 2,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1E1B23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT - 40,
    minHeight: SCREEN_HEIGHT * 0.55,
    paddingBottom: 50,
  },
  sheetBody: {
    flex: 1,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
  },
  replyContainer: {
    paddingVertical: 6,
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2532',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  replyAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    color: '#F4E7C5',
    fontWeight: '800',
    fontSize: 13,
  },
  replyUsername: {
    fontSize: 12,
    fontWeight: '700',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,215,0,0.22)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  starText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
  },
  timestamp: {
    color: '#766E81',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  replyTimestamp: {
    fontSize: 10,
  },
  commentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
  },
  replyText: {
    fontSize: 13,
    lineHeight: 17,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#A9A0B8',
    fontSize: 12,
    fontWeight: '700',
  },
  repliesContainer: {
    marginTop: 6,
    marginLeft: 56,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(160,113,202,0.35)',
    paddingLeft: 16,
    paddingBottom: 4,
  },
  threadDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#A071CA',
    marginRight: 2,
  },
  viewRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 48,
    marginTop: 2,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
  },
  hideRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
  },
  viewRepliesText: {
    color: '#A071CA',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 10,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    color: '#A9A0B8',
    fontSize: 13,
  },
  loadingMore: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    paddingVertical: 16,
  },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(160,113,202,0.1)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  replyingText: {
    flex: 1,
    color: '#A071CA',
    fontSize: 12,
    fontWeight: '700',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  inputAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2532',
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    maxHeight: 80,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#A071CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(160,113,202,0.3)',
  },
});
