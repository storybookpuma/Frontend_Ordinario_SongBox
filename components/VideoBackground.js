import React, { useEffect } from 'react';
import { InteractionManager, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export default function VideoBackground({ source }) {
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      player.play();
    });

    return () => {
      task.cancel();
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}
