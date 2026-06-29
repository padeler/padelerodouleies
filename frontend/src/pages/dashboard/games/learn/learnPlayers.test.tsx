import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useI18nStore } from '../../../../i18n/store';
import { CountThem } from './CountThem';
import { MatchCase } from './MatchCase';
import { WhatsNext } from './WhatsNext';
import { PutInOrder } from './PutInOrder';
import { HearIt } from './HearIt';
import type { DeckItem } from './learnEngine';

function num(n: number): DeckItem {
  return { token: `n${n}`, glyph: String(n), glyph_alt: null, audio_url: `/a/n${n}` };
}
function letter(token: string, upper: string, lower: string): DeckItem {
  return { token, glyph: upper, glyph_alt: lower, audio_url: `/a/${token}` };
}

beforeAll(() => {
  useI18nStore.getState().setTranslations({ 'games.learn.replay': { el: 'Άκου ξανά', en: 'Listen again' } });
  useI18nStore.getState().setLocale('en');
});

describe('CountThem', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the right number of objects and reports a correct pick', () => {
    const onAnswer = vi.fn();
    const playToken = vi.fn();
    render(
      <CountThem
        round={{ kind: 'count', count: 3, objectGlyph: '⭐', answer: num(3), choices: [num(2), num(3), num(4)] }}
        onAnswer={onAnswer}
        playToken={playToken}
      />,
    );
    expect(screen.getAllByText('⭐')).toHaveLength(3);
    fireEvent.click(screen.getByText('3'));
    expect(playToken).toHaveBeenCalledWith('n3');
    act(() => void vi.advanceTimersByTime(800));
    expect(onAnswer).toHaveBeenCalledWith(true, expect.objectContaining({ correctToken: 'n3' }));
  });

  it('reports a wrong pick', () => {
    const onAnswer = vi.fn();
    render(
      <CountThem
        round={{ kind: 'count', count: 2, objectGlyph: '⭐', answer: num(2), choices: [num(2), num(5)] }}
        onAnswer={onAnswer}
        playToken={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('5'));
    act(() => void vi.advanceTimersByTime(800));
    expect(onAnswer).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ pickedToken: 'n5', correctToken: 'n2' }),
    );
  });
});

describe('MatchCase', () => {
  const round = {
    kind: 'match' as const,
    left: [letter('l01', 'Α', 'α'), letter('l02', 'Β', 'β')],
    right: [letter('l02', 'Β', 'β'), letter('l01', 'Α', 'α')],
  };

  it('clears only when every pair is linked', () => {
    const onAnswer = vi.fn();
    render(<MatchCase round={round} onAnswer={onAnswer} playToken={vi.fn()} />);
    fireEvent.click(screen.getByText('Α')); // upper
    fireEvent.click(screen.getByText('α')); // matching lower
    expect(onAnswer).not.toHaveBeenCalled(); // one pair left
    fireEvent.click(screen.getByText('Β'));
    fireEvent.click(screen.getByText('β'));
    expect(onAnswer).toHaveBeenCalledWith(true, expect.anything());
  });

  it('reports a wrong link', () => {
    const onAnswer = vi.fn();
    render(<MatchCase round={round} onAnswer={onAnswer} playToken={vi.fn()} />);
    fireEvent.click(screen.getByText('Α'));
    fireEvent.click(screen.getByText('β')); // wrong lower
    expect(onAnswer).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ pickedToken: 'l02', correctToken: 'l01' }),
    );
  });
});

describe('WhatsNext', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the run with a blank and grades the successor', () => {
    const onAnswer = vi.fn();
    render(
      <WhatsNext
        round={{ kind: 'whats_next', prefix: [num(1), num(2), num(3)], answer: num(4), choices: [num(4), num(7)] }}
        onAnswer={onAnswer}
        playToken={vi.fn()}
      />,
    );
    expect(screen.getByText('?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('4'));
    act(() => void vi.advanceTimersByTime(800));
    expect(onAnswer).toHaveBeenCalledWith(true, expect.objectContaining({ correctToken: 'n4' }));
  });
});

describe('PutInOrder', () => {
  it('accepts taps in order and clears', () => {
    const onAnswer = vi.fn();
    render(
      <PutInOrder
        round={{ kind: 'order', sequence: [num(1), num(2), num(3)], shown: [num(3), num(1), num(2)] }}
        onAnswer={onAnswer}
        playToken={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    expect(onAnswer).toHaveBeenCalledWith(true, expect.anything());
  });

  it('reports a wrong order tap', () => {
    const onAnswer = vi.fn();
    render(
      <PutInOrder
        round={{ kind: 'order', sequence: [num(1), num(2), num(3)], shown: [num(3), num(1), num(2)] }}
        onAnswer={onAnswer}
        playToken={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('2')); // expected 1 first
    expect(onAnswer).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ pickedToken: 'n2', correctToken: 'n1' }),
    );
  });
});

describe('HearIt (canvas action level)', () => {
  it('speaks the "find" prompt for the target on entry', () => {
    const playFind = vi.fn();
    render(
      <HearIt
        round={{ kind: 'hear', target: num(7), choices: [num(3), num(7), num(9)] }}
        onAnswer={vi.fn()}
        playFind={playFind}
      />,
    );
    // Drawing/hit-testing is exercised by hearEngine.test.ts (jsdom has no
    // canvas 2D); here we just assert the prompt is auto-spoken on mount.
    expect(playFind).toHaveBeenCalledWith('n7');
  });
});
