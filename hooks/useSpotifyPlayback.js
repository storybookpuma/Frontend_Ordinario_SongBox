import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { queryKeys } from '../api/queryKeys';

export function useSpotifyPlayback() {
  const { axiosInstance, user } = useContext(AuthContext);

  return useQuery({
    queryKey: queryKeys.spotifyCurrentlyPlaying,
    enabled: Boolean(axiosInstance && user),
    queryFn: async () => {
      const response = await axiosInstance.get('/spotify/currently_playing');
      return response.data;
    },
    refetchInterval: 15000,
    retry: false,
    staleTime: 10000,
  });
}
