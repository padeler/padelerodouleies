import { ChoiceGrid } from './ChoiceGrid';
import { TimeTrialBar } from './TimeTrialBar';
import { useDelayedAnswer } from './useDelayedAnswer';
import { TIME_LIMIT_SECONDS, type DeckItem, type RoundFeedback, type WhatsNextRound } from './learnEngine';

/** What Comes Next (slot 3): show a run, then tap the item that follows. Timed. */
export function WhatsNext({
  round,
  onAnswer,
  playToken,
}: {
  round: WhatsNextRound;
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
    <div className="learn-next">
      <TimeTrialBar
        durationMs={TIME_LIMIT_SECONDS * 1000}
        paused={picked !== null}
        onExpire={() =>
          submit('', false, {
            pickedToken: null,
            pickedGlyph: null,
            correctToken: round.answer.token,
            correctGlyph: round.answer.glyph,
          })
        }
      />
      <div className="learn-sequence">
        {round.prefix.map((item) => (
          <span key={item.token} className="learn-seq-item">
            {item.glyph}
          </span>
        ))}
        <span className="learn-seq-item learn-seq-blank">?</span>
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
