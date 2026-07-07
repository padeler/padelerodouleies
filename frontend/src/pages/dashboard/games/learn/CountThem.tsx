import { ChoiceGrid } from './ChoiceGrid';
import { useDelayedAnswer } from './useDelayedAnswer';
import type { CountRound, DeckItem, RoundFeedback } from './learnEngine';

/** Count Them (numbers slot 0): tap-countable objects → pick the numeral. */
export function CountThem({
  round,
  onAnswer,
  playToken,
}: {
  round: CountRound;
  onAnswer: (correct: boolean, feedback: RoundFeedback) => void;
  playToken: (token: string) => void;
}) {
  const { picked, submit } = useDelayedAnswer(onAnswer);

  function pick(item: DeckItem): void {
    playToken(item.token);
    submit(item.token, item.token === round.answer.token, {
      pickedToken: item.token,
      pickedGlyph: item.glyph,
      correctToken: round.answer.token,
      correctGlyph: round.answer.glyph,
    });
  }

  return (
    <div className="learn-count">
      <div className="learn-objects">
        {/* Staggered pop-in cascade — the objects appear one after another,
            which invites counting them in order. */}
        {Array.from({ length: round.count }, (_, i) => (
          <span key={i} className="learn-object" style={{ animationDelay: `${i * 70}ms` }}>
            {round.objectGlyph}
          </span>
        ))}
      </div>
      <ChoiceGrid
        choices={round.choices}
        onPick={(item) => pick(item)}
        pickedToken={picked}
        correctToken={round.answer.token}
      />
    </div>
  );
}
