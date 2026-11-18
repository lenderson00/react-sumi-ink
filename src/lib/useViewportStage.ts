import { useEffect, useState } from 'react';
import { stageScaleForViewport } from './viewport';

export const useViewportStage = () => {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const mq = () => setScale(stageScaleForViewport(window.innerWidth));
    mq();
    window.addEventListener('resize', mq);
    return () => window.removeEventListener('resize', mq);
  }, []);
  return { scale, stickerScale: scale };
};