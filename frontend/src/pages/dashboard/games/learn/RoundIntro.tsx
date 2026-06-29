import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../../i18n/store';
import { playCountTick, playGo } from '../../../../lib/sound';
import type { LevelType } from './learnEngine';

const TICK_MS = 800; // beat between countdown numbers
const GO_HOLD_MS = 1000; // "Πάμε!" lingers after the countdown so the start isn't abrupt
const SPEAK_PAUSE_MS = 1500; // pause for a spoken-only (untimed) level intro
const COUNTDOWN_LEAD_MS = 400; // let the spoken intro lead the countdown a touch

/**
 * The pause before a round starts. On a new level it speaks the level's intro
 * sentence ("audible description of the round"); on a time-trial round it then
 * runs a 3·2·1 countdown so the kid is ready when the clock starts. Calls
 * `onReady` exactly once when the lead-in finishes, at which point the parent
 * swaps in the interactive player (and its timer).
 */
export function RoundIntro({
  levelType,
  speak,
  countdown,
  playPhrase,
  onReady,
}: {
  levelType: LevelType;
  speak: boolean;
  countdown: boolean;
  playPhrase: (level: LevelType) => Promise<void>;
  onReady: () => void;
}) {
  const t = useT();
  // `label` drives the big text: a countdown digit, "Πάμε!", or the ready hint.
  const [label, setLabel] = useState<string>(() => (countdown ? '3' : t('games.learn.get_ready')));
  const [isGo, setIsGo] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    const timers: number[] = [];
    let cancelled = false;
    const fire = (): void => {
      if (cancelled || firedRef.current) return;
      firedRef.current = true;
      onReady();
    };

    if (speak) void playPhrase(levelType);

    if (countdown) {
      const runCountdown = (): void => {
        ['3', '2', '1'].forEach((value, i) => {
          timers.push(
            window.setTimeout(() => {
              if (cancelled) return;
              setLabel(value);
              setIsGo(false);
              playCountTick();
            }, i * TICK_MS),
          );
        });
        // Show "Πάμε!" and hold it a beat before handing off — the start feels
        // less abrupt and the kid has a moment to brace for the timed round.
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            setLabel(t('games.learn.go'));
            setIsGo(true);
            playGo();
          }, 3 * TICK_MS),
        );
        timers.push(window.setTimeout(fire, 3 * TICK_MS + GO_HOLD_MS));
      };
      timers.push(window.setTimeout(runCountdown, speak ? COUNTDOWN_LEAD_MS : 0));
    } else {
      // Spoken description only: a short pause, then start.
      timers.push(window.setTimeout(fire, SPEAK_PAUSE_MS));
    }

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="learn-intro">
      {countdown ? (
        // `key` restarts the pop animation on each change.
        <div key={label} className={isGo ? 'learn-go' : 'learn-countdown'}>
          {label}
        </div>
      ) : (
        <div className="learn-intro-ready">{label}</div>
      )}
    </div>
  );
}
