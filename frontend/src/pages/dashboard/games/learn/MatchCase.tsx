import { useEffect, useRef, useState } from 'react';
import type { MatchRound, RoundFeedback } from './learnEngine';

const NO_FEEDBACK: RoundFeedback = {
  pickedToken: null,
  pickedGlyph: null,
  correctToken: '',
  correctGlyph: '',
};

// Distinct per-pair colours (matched the exercises' Match Pairs palette) so each
// linked pair reads as its own colour at a glance. Old-tablet safe (plain hex).
const PAIR_COLORS = ['#ff6b6b', '#4d96ff', '#6bcb77', '#ffb703', '#b56bff', '#ff8fab'];
const pairColor = (index: number) => PAIR_COLORS[index % PAIR_COLORS.length]!;

// Hold the cleared round on screen briefly so the spoken letter name finishes and
// the kid sees the last pair colour in before the result panel takes over.
const FINAL_DELAY_MS = 900;

/**
 * Match Case (letters slot 0): tap an uppercase letter, then its lowercase
 * partner. A correct link locks the pair in its own colour; a wrong link costs a
 * life (reports `false`, which the shell turns into a new round). When every pair
 * is linked the round is cleared after a short beat (so the TTS can finish).
 */
export function MatchCase({
  round,
  onAnswer,
  playToken,
}: {
  round: MatchRound;
  onAnswer: (correct: boolean, feedback: RoundFeedback) => void;
  playToken: (token: string) => void;
}) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  // token -> 0-based order it was matched in, which drives its pair colour/badge.
  const [matchedOrder, setMatchedOrder] = useState<Map<string, number>>(new Map());
  const [wrong, setWrong] = useState<string | null>(null);
  const finalTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(finalTimer.current), []);

  function pickLeft(token: string): void {
    if (matchedOrder.has(token)) return;
    playToken(token);
    setSelectedLeft(token);
    setWrong(null);
  }

  function pickRight(token: string): void {
    if (matchedOrder.has(token) || selectedLeft === null) return;
    playToken(token);
    if (token === selectedLeft) {
      const next = new Map(matchedOrder).set(token, matchedOrder.size);
      setMatchedOrder(next);
      setSelectedLeft(null);
      if (next.size === round.left.length) {
        finalTimer.current = window.setTimeout(() => onAnswer(true, NO_FEEDBACK), FINAL_DELAY_MS);
      }
    } else {
      setWrong(token);
      // The kid linked the wrong pair: report what they picked (the lowercase
      // glyph) against the uppercase they had selected.
      const picked = round.right.find((it) => it.token === token);
      const correct = round.left.find((it) => it.token === selectedLeft);
      setSelectedLeft(null);
      onAnswer(false, {
        pickedToken: token,
        pickedGlyph: picked?.glyph_alt ?? null,
        correctToken: selectedLeft,
        correctGlyph: correct?.glyph ?? '',
      });
    }
  }

  return (
    <div className="learn-match">
      <div className="learn-match-col">
        {round.left.map((item) => {
          const order = matchedOrder.get(item.token);
          const color = order !== undefined ? pairColor(order) : undefined;
          return (
            <button
              key={item.token}
              type="button"
              className={`learn-match-tile ${order !== undefined ? 'matched' : ''} ${
                selectedLeft === item.token ? 'selected' : ''
              }`}
              style={color ? { background: color, borderColor: color } : undefined}
              disabled={order !== undefined}
              onClick={() => pickLeft(item.token)}
            >
              {item.glyph}
              {order !== undefined && <span className="learn-match-badge">{order + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="learn-match-col">
        {round.right.map((item) => {
          const order = matchedOrder.get(item.token);
          const color = order !== undefined ? pairColor(order) : undefined;
          const iconEmoji = round.icons?.get(item.token);
          const display = iconEmoji ?? item.glyph_alt;
          return (
            <button
              key={item.token}
              type="button"
              className={`learn-match-tile lower ${order !== undefined ? 'matched' : ''} ${
                iconEmoji ? 'has-icon' : ''
              } ${wrong === item.token ? 'wrong' : ''}`}
              style={color ? { background: color, borderColor: color } : undefined}
              disabled={order !== undefined}
              onClick={() => pickRight(item.token)}
            >
              {display}
              {order !== undefined && <span className="learn-match-badge">{order + 1}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
