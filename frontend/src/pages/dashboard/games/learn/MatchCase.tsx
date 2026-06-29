import { useState } from 'react';
import type { MatchRound } from './learnEngine';

/**
 * Match Case (letters slot 0): tap an uppercase letter, then its lowercase
 * partner. A correct link locks the pair; a wrong link costs a life (reports
 * `false`, which the shell turns into a new round). When every pair is linked
 * the round is cleared.
 */
export function MatchCase({
  round,
  onAnswer,
  playToken,
}: {
  round: MatchRound;
  onAnswer: (correct: boolean) => void;
  playToken: (token: string) => void;
}) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);

  function pickLeft(token: string): void {
    if (matched.has(token)) return;
    playToken(token);
    setSelectedLeft(token);
    setWrong(null);
  }

  function pickRight(token: string): void {
    if (matched.has(token) || selectedLeft === null) return;
    playToken(token);
    if (token === selectedLeft) {
      const next = new Set(matched).add(token);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === round.left.length) onAnswer(true);
    } else {
      setWrong(token);
      setSelectedLeft(null);
      onAnswer(false);
    }
  }

  return (
    <div className="learn-match">
      <div className="learn-match-col">
        {round.left.map((item) => (
          <button
            key={item.token}
            type="button"
            className={`learn-match-tile ${matched.has(item.token) ? 'matched' : ''} ${
              selectedLeft === item.token ? 'selected' : ''
            }`}
            disabled={matched.has(item.token)}
            onClick={() => pickLeft(item.token)}
          >
            {item.glyph}
          </button>
        ))}
      </div>
      <div className="learn-match-col">
        {round.right.map((item) => (
          <button
            key={item.token}
            type="button"
            className={`learn-match-tile lower ${matched.has(item.token) ? 'matched' : ''} ${
              wrong === item.token ? 'wrong' : ''
            }`}
            disabled={matched.has(item.token)}
            onClick={() => pickRight(item.token)}
          >
            {item.glyph_alt}
          </button>
        ))}
      </div>
    </div>
  );
}
