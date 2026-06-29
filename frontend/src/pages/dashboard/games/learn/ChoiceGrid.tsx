import type { DeckItem } from './learnEngine';

/**
 * A row of big tappable glyph choices shared by the single-answer levels
 * (Count Them, Listen, What Comes Next). Feedback colouring is driven by the
 * parent: once `pickedToken` is set the grid locks and marks the picked tile
 * correct/wrong and reveals the right answer.
 */
export function ChoiceGrid({
  choices,
  onPick,
  pickedToken,
  correctToken,
}: {
  choices: DeckItem[];
  onPick: (item: DeckItem) => void;
  pickedToken: string | null;
  correctToken: string;
}) {
  const locked = pickedToken !== null;
  return (
    <div className="learn-choices">
      {choices.map((item) => {
        let state = '';
        if (locked) {
          if (item.token === correctToken) state = 'correct';
          else if (item.token === pickedToken) state = 'wrong';
        }
        return (
          <button
            key={item.token}
            type="button"
            className={`learn-choice ${state}`}
            disabled={locked}
            onClick={() => onPick(item)}
          >
            {item.glyph}
          </button>
        );
      })}
    </div>
  );
}
