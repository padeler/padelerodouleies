import { ChoiceGrid } from './ChoiceGrid';
import { TimeTrialBar } from './TimeTrialBar';
import { useDelayedAnswer } from './useDelayedAnswer';
import { TIME_LIMIT_SECONDS, type WhatsNextRound } from './learnEngine';

/** What Comes Next (slot 3): show a run, then tap the item that follows. Timed. */
export function WhatsNext({
  round,
  onAnswer,
  playToken,
}: {
  round: WhatsNextRound;
  onAnswer: (correct: boolean) => void;
  playToken: (token: string) => void;
}) {
  const { picked, submit } = useDelayedAnswer(onAnswer);

  function pick(token: string): void {
    playToken(token);
    submit(token, token === round.answer.token);
  }

  return (
    <div className="learn-next">
      <TimeTrialBar
        durationMs={TIME_LIMIT_SECONDS * 1000}
        paused={picked !== null}
        onExpire={() => submit('', false)}
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
        onPick={(item) => pick(item.token)}
        pickedToken={picked}
        correctToken={round.answer.token}
      />
    </div>
  );
}
