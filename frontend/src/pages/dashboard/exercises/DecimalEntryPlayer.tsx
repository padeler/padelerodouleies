import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { useT } from '../../../i18n/store';
import type { ExerciseView } from '../../../lib/types';

interface Props {
  exercise: ExerciseView;
  disabled: boolean;
  /** Resets the typed value when the parent flips this (e.g. after a wrong try). */
  resetSignal: number;
  onAnswer: (response: string) => void;
}

/**
 * Type a decimal number on an on-screen keypad with a υποδιαστολή (comma) key.
 * Posts the typed string; the server normalises comma/dot and compares exactly.
 * No free-text field (invariant #1 ethos).
 */
export function DecimalEntryPlayer({ exercise, disabled, resetSignal, onAnswer }: Props) {
  const t = useT();
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue('');
  }, [resetSignal, exercise.id]);

  const push = (d: string) => {
    if (disabled) return;
    if (d === ',' && value.includes(',')) return; // one decimal separator at most
    setValue((v) => (v.length >= 10 ? v : v + d));
  };
  const backspace = () => setValue((v) => v.slice(0, -1));
  const submit = () => {
    if (disabled || value.length === 0) return;
    onAnswer(value);
  };

  return (
    <div className="num-entry">
      <div className="num-display">{value || ' '}</div>
      <div className="num-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} type="button" className="num-key" disabled={disabled} onClick={() => push(k)}>
            {k}
          </button>
        ))}
        <button type="button" className="num-key" disabled={disabled} onClick={() => push(',')}>
          ,
        </button>
        <button type="button" className="num-key" disabled={disabled} onClick={() => push('0')}>
          0
        </button>
        <button type="button" className="num-key" disabled={disabled} onClick={backspace} aria-label="backspace">
          <Delete size={22} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="order-check"
        disabled={disabled || value.length === 0}
        onClick={submit}
      >
        {t('exercises.check')}
      </button>
    </div>
  );
}
