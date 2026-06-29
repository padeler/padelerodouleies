import { useState } from 'react';
import type { OrderRound } from './learnEngine';

/**
 * Put In Order (slot 2): tap the shuffled tiles in the correct order. Tapping
 * the right next tile places it; a wrong tap costs a life (reports `false`).
 * Tap-to-place, not HTML5 drag — drag is unreliable on the old tablet's touch.
 */
export function PutInOrder({
  round,
  onAnswer,
  playToken,
}: {
  round: OrderRound;
  onAnswer: (correct: boolean) => void;
  playToken: (token: string) => void;
}) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);

  function pick(token: string): void {
    if (placed.includes(token)) return;
    playToken(token);
    const expected = round.sequence[placed.length]!;
    if (token === expected.token) {
      const next = [...placed, token];
      setPlaced(next);
      setWrong(null);
      if (next.length === round.sequence.length) onAnswer(true);
    } else {
      setWrong(token);
      onAnswer(false);
    }
  }

  const glyphByToken = new Map(round.sequence.map((it) => [it.token, it.glyph]));

  return (
    <div className="learn-order">
      <div className="learn-order-slots">
        {round.sequence.map((item, i) => (
          <span key={item.token} className="learn-order-slot">
            {i < placed.length ? glyphByToken.get(placed[i]!) : ''}
          </span>
        ))}
      </div>
      <div className="learn-order-pool">
        {round.shown.map((item) => (
          <button
            key={item.token}
            type="button"
            className={`learn-order-tile ${placed.includes(item.token) ? 'placed' : ''} ${
              wrong === item.token ? 'wrong' : ''
            }`}
            disabled={placed.includes(item.token)}
            onClick={() => pick(item.token)}
          >
            {item.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}
