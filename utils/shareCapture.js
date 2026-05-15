import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

export const shareViewCapture = async (ref, filename = 'songbox-share') => {
  if (!ref?.current) {
    throw new Error('No capture target available.');
  }

  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    fileName: filename,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Share SongBox capture',
  });
};
