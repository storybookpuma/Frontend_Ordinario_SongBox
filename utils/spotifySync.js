export const waitForSpotifySyncJob = async (axiosInstance, jobId, { intervalMs = 2500, maxAttempts = 24 } = {}) => {
  if (!jobId) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const response = await axiosInstance.get(`/spotify/sync/status/${jobId}`);
    const status = response.data?.status;
    if (status === 'finished') return response.data;
    if (status === 'failed') throw new Error(response.data?.message || 'Spotify sync failed.');
  }

  return { status: 'timeout', jobId };
};
