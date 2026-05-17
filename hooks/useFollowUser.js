import { useContext } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { queryKeys } from '../api/queryKeys';
import { getApiErrorMessage } from '../utils/errors';

export const useFollowUser = (profileId) => {
  const { axiosInstance, user, setUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (shouldFollow) => axiosInstance.post(shouldFollow ? '/follow_user' : '/unfollow_user', {
      profile_id: profileId,
    }),
    onMutate: async (shouldFollow) => {
      const previousUser = user;
      if (user) {
        const following = Array.isArray(user.following) ? user.following : [];
        setUser({
          ...user,
          following: shouldFollow
            ? Array.from(new Set([...following, profileId]))
            : following.filter((id) => id !== profileId),
        });
      }
      return { previousUser };
    },
    onSuccess: (response) => {
      showToast(response.data.message || 'Perfil actualizado.');
      queryClient.invalidateQueries({ queryKey: queryKeys.followingDetails(user?.following || []) });
    },
    onError: (error, _shouldFollow, context) => {
      if (context?.previousUser) setUser(context.previousUser);
      showToast(getApiErrorMessage(error, 'No se pudo actualizar el seguimiento.'));
    },
  });

  return {
    follow: () => mutation.mutate(true),
    unfollow: () => mutation.mutate(false),
    isPending: mutation.isPending,
  };
};
