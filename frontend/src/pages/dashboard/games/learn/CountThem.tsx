import { ChoiceGrid } from './ChoiceGrid';
import { useDelayedAnswer } from './useDelayedAnswer';
import type { CountRound } from './learnEngine';

/** Count Them (numbers slot 0): tap-countable objects → pick the numeral. */
export function CountThem({
  round,
  onAnswer,
  playToken,
}: {
  round: CountRound;
  onAnswer: (correct: boolean) => void;
  playToken: (token: string) => void;
}) {
  const { picked, submit } = useDelayedAnswer(onAnswer);

  function pick(token: string): void {
    playToken(token);
    submit(token, token === round.answer.token);
  }

  return (
    <div className="learn-count">
      <div className="learn-objects">
        {Array.from({ length: round.count }, (_, i) => (
          <span key={i} className="learn-object">
            {round.objectGlyph}
          </span>
        ))}
      </div>
      <ChoiceGrid
        choices={round.choices}
        onPick={(item) => pick(item.token)}
        pickedToken={picked}
        correctToken={round.answer.token}
      />
    </div>
  );
}
