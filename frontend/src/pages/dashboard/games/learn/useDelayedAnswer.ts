import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared "tap → show feedback → report result" timing for the single-answer
 * levels: records the picked token, then after a short beat calls `onAnswer` so
 * the kid sees the correct/wrong colouring before the round advances.
 */
export function useDelayedAnswer(
  onAnswer: (correct: boolean) => void,
  delayMs = 750,
): { picked: string | null; submit: (token: string, correct: boolean) => void } {
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const submit = useCallback(
    (token: string, correct: boolean): void => {
      setPicked((prev) => (prev === null ? token : prev)); // ignore double taps
      timer.current = window.setTimeout(() => onAnswer(correct), delayMs);
    },
    [onAnswer, delayMs],
  );

  return { picked, submit };
}
