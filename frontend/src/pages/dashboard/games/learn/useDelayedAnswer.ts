import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoundFeedback } from './learnEngine';

/**
 * Shared "tap → show feedback → report result" timing for the single-answer
 * levels: records the picked token, then after a short beat calls `onAnswer` so
 * the kid sees the correct/wrong colouring on the choice grid before the result
 * panel takes over.
 */
export function useDelayedAnswer(
  onAnswer: (correct: boolean, feedback: RoundFeedback) => void,
  delayMs = 750,
): {
  picked: string | null;
  submit: (token: string, correct: boolean, feedback: RoundFeedback) => void;
} {
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const submit = useCallback(
    (token: string, correct: boolean, feedback: RoundFeedback): void => {
      setPicked((prev) => (prev === null ? token : prev)); // ignore double taps
      timer.current = window.setTimeout(() => onAnswer(correct, feedback), delayMs);
    },
    [onAnswer, delayMs],
  );

  return { picked, submit };
}
