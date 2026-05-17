import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';
import { getUserId } from '../utils/normalizers';

export function useSpotifyPlayback({ enabled = true } = {}) {
  const { axiosInstance, user } = useContext(AuthContext);
  const userId = getUserId(user);

  return useQuery({
    queryKey: queryKeys.spotifyCurrentlyPlaying(userId),
    enabled: Boolean(enabled && axiosInstance && userId),
    queryFn: async () => {
      const response = await axiosInstance.get('/spotify/currently_playing');
      return response.data;
    },
    refetchInterval: enabled ? 15000 : false,
    retry: false,
    staleTime: 10000,
  });
}
