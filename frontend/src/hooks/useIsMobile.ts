import { useState, useEffect, useCallback } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth < breakpoint);
  }, [breakpoint]);

  useEffect(() => {
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return isMobile;
}
