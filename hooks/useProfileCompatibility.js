import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';

export const useProfileCompatibility = (profileId) => {
  const { axiosInstance, user } = useContext(AuthContext);

  return useQuery({
    queryKey: queryKeys.profileCompatibility(profileId),
    enabled: Boolean(axiosInstance && user && profileId),
    queryFn: async () => {
      const response = await axiosInstance.get('/profile_compatibility', {
        params: { profile_id: profileId },
      });
      return response.data;
    },
  });
};
