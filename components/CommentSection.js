// src/components/CommentSection.js

import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Alert, 
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { AuthContext } from '../context/AuthContext';
import { SkeletonList } from './Skeleton';

export default function CommentSection({ entityType, entityId, comments = [], onAddComment, showLoadErrorAlert = true }) { 
  const { axiosInstance, user } = useContext(AuthContext);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const commentsRef = useRef(comments);
  const onAddCommentRef = useRef(onAddComment);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    onAddCommentRef.current = onAddComment;
  }, [onAddComment]);

  const sortComments = (commentsList) => {
    return [...commentsList].sort((a, b) => b.likes - a.likes);
  };

  const fetchComments = useCallback(async (pageNumber) => {
    if (!entityId) {
      return;
    };

    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      if (pageNumber === 1 && commentsRef.current.length === 0) setIsLoading(true);

      const response = await axiosInstance.get(`/${entityType}/${entityId}/comments`, {
        params: {
          page: pageNumber,
          limit: 10,
        },
      });
      if (pageNumber === 1) {
        const sortedComments = sortComments(response.data.comments || []);
        onAddCommentRef.current(sortedComments);
      } else {
        const combinedComments = [...commentsRef.current, ...(response.data.comments || [])];
        const sortedComments = sortComments(combinedComments);
        onAddCommentRef.current(sortedComments);
      }

      setTotalPages(response.data.pagination.total_pages);
      setPage(pageNumber);
    } catch (error) {
      console.error("Error al obtener los comentarios:", error.message);
      if (showLoadErrorAlert) {
        Alert.alert("Error", "No se pudieron cargar los comentarios. Verifica la conexión.");
      }
    } finally {
      if (pageNumber === 1) setIsLoading(false);
    }
  }, [axiosInstance, entityId, entityType, showLoadErrorAlert]);

  useEffect(() => {
    const fetchCommentsInitial = async () => {
      try {
        if (!user || !entityId) {
          return;
        }
        fetchComments(1);
      } catch (error) {
        console.error("Error al inicializar la CommentSection:", error);
        Alert.alert("Error", "Hubo un problema al inicializar la sección de comentarios. Por favor, intenta nuevamente.");
      }
    };

    fetchCommentsInitial();
  }, [entityId, fetchComments, user]);

  const handleLoadMore = () => {
    if (page < totalPages && !isLoading) {
      fetchComments(page + 1);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      await axiosInstance.delete(`/${entityType}/${entityId}/comments/${commentId}`);

      const updatedComments = comments.filter(comment => comment._id !== commentId);
      onAddComment(updatedComments);
    } catch (error) {
      console.error("Error al eliminar el comentario:", error.message);
      Alert.alert("Error", "No se pudo eliminar el comentario. Verifica la conexión.");
    }
  };

  const handleLike = async (commentId) => {
    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      const response = await axiosInstance.post(`/${entityType}/${entityId}/comments/${commentId}/like`);

      const updatedComment = response.data.comment;

      const updatedComments = comments.map(comment => {
        if (comment._id === updatedComment._id) {
          return updatedComment;
        }
        return comment;
      });

      const sortedComments = sortComments(updatedComments);
      onAddComment(sortedComments);
    } catch (error) {
      console.error("Error al dar like:", error.message);
      Alert.alert("Error", "No se pudo dar like al comentario. Verifica la conexión.");
    }
  };

  const handleDislike = async (commentId) => {
    try {
      if (!axiosInstance) {
        throw new Error("axiosInstance no está definido en el contexto.");
      }

      const response = await axiosInstance.post(`/${entityType}/${entityId}/comments/${commentId}/dislike`);

      const updatedComment = response.data.comment;

      const updatedComments = comments.map(comment => {
        if (comment._id === updatedComment._id) {
          return updatedComment;
        }
        return comment;
      });

      const sortedComments = sortComments(updatedComments);
      onAddComment(sortedComments);
    } catch (error) {
      console.error("Error al dar dislike:", error.message);
      Alert.alert("Error", "No se pudo dar dislike al comentario. Verifica la conexión.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comentarios</Text>
      <View style={styles.commentsContainer}>
        {isLoading && comments.length === 0 ? (
          <SkeletonList count={3} />
        ) : Array.isArray(comments) && comments.length === 0 ? (
          <Text style={styles.noCommentsText}>No hay comentarios aún.</Text>
        ) : (
          comments.map((comment) => {
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
        {page < totalPages && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
            <Text style={styles.loadMoreText}>Cargar más comentarios</Text>
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
