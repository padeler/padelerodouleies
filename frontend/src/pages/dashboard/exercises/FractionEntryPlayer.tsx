import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { useT } from '../../../i18n/store';
import type { ExerciseView } from '../../../lib/types';

interface Props {
  exercise: ExerciseView;
  disabled: boolean;
  /** Resets both fields when the parent flips this (e.g. after a wrong try). */
  resetSignal: number;
  onAnswer: (response: { numerator: number; denominator: number }) => void;
}

type FractionField = 'numerator' | 'denominator';

/**
 * Enter a fraction (κλάσμα) by tapping numerator and denominator fields then
 * typing digits on a shared on-screen keypad. Tap either field to switch focus.
 * Posts {numerator, denominator}; the server grades by cross-multiplication when
 * accept_equivalent is true (e.g. 6/8 == 3/4).
 */
export function FractionEntryPlayer({ exercise, disabled, resetSignal, onAnswer }: Props) {
  const t = useT();
  const [numerator, setNumerator] = useState('');
  const [denominator, setDenominator] = useState('');
  const [activeField, setActiveField] = useState<FractionField>('numerator');

  useEffect(() => {
    setNumerator('');
    setDenominator('');
    setActiveField('numerator');
  }, [resetSignal, exercise.id]);

  const setter = activeField === 'numerator' ? setNumerator : setDenominator;

  const push = (d: string) => {
    if (disabled) return;
    setter((v) => (v.length >= 4 ? v : v + d));
  };
  const backspace = () => setter((v) => v.slice(0, -1));

  const canSubmit = !disabled && numerator.length > 0 && denominator.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onAnswer({ numerator: parseInt(numerator, 10), denominator: parseInt(denominator, 10) });
  };

  return (
    <div className="num-entry frac-entry">
      <div className="frac-display">
        <button
          type="button"
          className={`frac-field${activeField === 'numerator' ? ' frac-active' : ''}`}
          onClick={() => !disabled && setActiveField('numerator')}
          aria-label={t('exercises.fraction_numerator')}
        >
          {numerator || ' '}
        </button>
        <div className="frac-bar" />
        <button
          type="button"
          className={`frac-field${activeField === 'denominator' ? ' frac-active' : ''}`}
          onClick={() => !disabled && setActiveField('denominator')}
          aria-label={t('exercises.fraction_denominator')}
        >
          {denominator || ' '}
        </button>
      </div>

      <div className="num-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} type="button" className="num-key" disabled={disabled} onClick={() => push(k)}>
            {k}
          </button>
        ))}
        <button type="button" className="num-key" disabled={disabled} onClick={backspace} aria-label="backspace">
          <Delete size={22} aria-hidden="true" />
        </button>
        <button type="button" className="num-key" disabled={disabled} onClick={() => push('0')}>
          0
        </button>
        <button
          type="button"
          className="num-key num-check"
          disabled={!canSubmit}
          onClick={submit}
        >
          {t('exercises.check')}
        </button>
      </div>
    </div>
  );
}
