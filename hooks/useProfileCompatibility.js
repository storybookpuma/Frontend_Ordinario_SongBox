import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';

export const useProfileCompatibility = (profileId) => {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useQuery({
    queryKey: queryKeys.profileCompatibility(profileId, userId),
    enabled: Boolean(axiosInstance && userId && profileId),
    queryFn: async () => {
      const response = await axiosInstance.get('/profile_compatibility', {
        params: { profile_id: profileId },
      });
      return response.data;
    },
  });
};
