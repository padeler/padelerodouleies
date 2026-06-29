import { useEffect, useRef, useState } from 'react';

/**
 * A shrinking countdown bar for the time-trial levels. Runs on rAF; when it
 * empties it calls `onExpire` once. Set `paused` (e.g. after the kid has
 * answered) to freeze it. `onExpire` is held in a ref so parent re-renders don't
 * restart the clock.
 */
export function TimeTrialBar({
  durationMs,
  paused,
  onExpire,
}: {
  durationMs: number;
  paused: boolean;
  onExpire: () => void;
}) {
  const [progress, setProgress] = useState(1); // 1 → 0
  const startRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (paused) return;
    function frame(now: number): void {
      const p = Math.max(0, 1 - (now - startRef.current) / durationMs);
      setProgress(p);
      if (p <= 0) {
        onExpireRef.current();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, durationMs]);

  return (
    <div className="learn-timebar">
      <div
        className={`learn-timebar-fill ${progress < 0.34 ? 'low' : ''}`}
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
