import { useEffect, useState } from 'react';

export function useViewportHeight() {
  const [height, setHeight] = useState('100dvh');

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight;
      const dvh = window.visualViewport?.height || vh;
      
      // If there's a significant difference, we're likely in gesture navigation
      if (Math.abs(vh - dvh) > 20) {
        setHeight(`${dvh}px`);
      } else {
        setHeight('100dvh');
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.visualViewport?.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('resize', updateHeight);
    };
  }, []);

  return height;
}