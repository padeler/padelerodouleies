import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useI18nStore } from '../../../../i18n/store';
import { CountThem } from './CountThem';
import { MatchCase } from './MatchCase';
import { WhatsNext } from './WhatsNext';
import { PutInOrder } from './PutInOrder';
import { HearIt } from './HearIt';
import { FALLER_R, HEAR_H, HEAR_W } from './hearEngine';
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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const round = {
    kind: 'match' as const,
    left: [letter('l01', 'Α', 'α'), letter('l02', 'Β', 'β')],
    right: [letter('l02', 'Β', 'β'), letter('l01', 'Α', 'α')],
  };

  it('clears only when every pair is linked (after a brief beat)', () => {
    const onAnswer = vi.fn();
    render(<MatchCase round={round} onAnswer={onAnswer} playToken={vi.fn()} />);
    fireEvent.click(screen.getByText('Α')); // upper
    fireEvent.click(screen.getByText('α')); // matching lower
    expect(onAnswer).not.toHaveBeenCalled(); // one pair left
    fireEvent.click(screen.getByText('Β'));
    fireEvent.click(screen.getByText('β'));
    expect(onAnswer).not.toHaveBeenCalled(); // held while the TTS finishes
    act(() => void vi.advanceTimersByTime(900));
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

  it('renders emoji icons from icons map when provided', () => {
    const roundWithIcons = {
      kind: 'match' as const,
      left: [letter('l01', 'Α', 'α'), letter('l03', 'Γ', 'γ')],
      right: [letter('l03', 'Γ', 'γ'), letter('l01', 'Α', 'α')],
      icons: new Map([['l01', '\u{1F41A}'], ['l03', '\u{1F431}']]), // 🐚, 🐱
    };
    const onAnswer = vi.fn();
    render(<MatchCase round={roundWithIcons} onAnswer={onAnswer} playToken={vi.fn()} />);
    // Tiles should render emoji from icons map
    expect(screen.getByText('\u{1F41A}')).toBeInTheDocument(); // 🐚
    expect(screen.getByText('\u{1F431}')).toBeInTheDocument(); // 🐱
    // Lowercase glyphs should NOT be rendered (replaced by emojis)
    expect(screen.queryByText('α')).not.toBeInTheDocument();
  });

  it('falls back to glyph_alt when icons map lacks an entry', () => {
    const partialIcons = {
      kind: 'match' as const,
      left: [letter('l01', 'Α', 'α'), letter('l07', 'Η', 'η')], // l07 has no icon
      right: [letter('l07', 'Η', 'η'), letter('l01', 'Α', 'α')],
      icons: new Map([['l01', '\u{1F41A}']]), // 🐚 for l01 only
    };
    render(<MatchCase round={partialIcons} onAnswer={vi.fn()} playToken={vi.fn()} />);
    expect(screen.getByText('\u{1F41A}')).toBeInTheDocument(); // 🐚 icon tile
    expect(screen.getByText('η')).toBeInTheDocument(); // fallback glyph for l07
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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('accepts taps in order and clears after a brief beat', () => {
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
    expect(onAnswer).not.toHaveBeenCalled(); // held while the TTS finishes
    act(() => void vi.advanceTimersByTime(900));
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

  describe('multi-target variant', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Fixes createHearWorld's internal shuffle so faller positions are
      // predictable (fake timers also hold off the rAF loop from moving them).
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // Mirrors hearEngine's private shuffleColumns(n, () => 0) + column layout
    // formula so the test can compute exactly where each faller starts.
    function fallerPosition(n: number, index: number): { x: number; y: number } {
      const cols = Array.from({ length: n }, (_, i) => i);
      for (let i = cols.length - 1; i > 0; i -= 1) {
        const tmp = cols[i]!;
        cols[i] = cols[0]!; // rng() === 0 → j is always 0
        cols[0] = tmp;
      }
      return { x: HEAR_W * ((cols[index]! + 0.5) / n), y: -FALLER_R - index * 90 };
    }

    function renderMultiTarget(choices: DeckItem[], target: DeckItem, onAnswer = vi.fn()) {
      const { container } = render(
        <HearIt
          round={{ kind: 'hear', target, choices, variant: 'multi-target' }}
          onAnswer={onAnswer}
          playFind={vi.fn()}
        />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: HEAR_W, height: HEAR_H, right: HEAR_W, bottom: HEAR_H, x: 0, y: 0, toJSON() {} }) as DOMRect;
      return { canvas, onAnswer };
    }

    it('needs every target faller tapped before it resolves as correct', () => {
      const target = num(7);
      const choices = [target, target, target, num(2), num(9)]; // 3 target fallers + 2 distractors
      const { canvas, onAnswer } = renderMultiTarget(choices, target);

      for (let i = 0; i < 2; i += 1) {
        const p = fallerPosition(choices.length, i);
        fireEvent.pointerDown(canvas, { clientX: p.x, clientY: p.y });
        expect(onAnswer).not.toHaveBeenCalled(); // still targets left to find
      }
      const last = fallerPosition(choices.length, 2);
      fireEvent.pointerDown(canvas, { clientX: last.x, clientY: last.y });
      act(() => void vi.advanceTimersByTime(900)); // freeze beat before reporting
      expect(onAnswer).toHaveBeenCalledWith(true, expect.objectContaining({ correctToken: 'n7' }));
    });

    it('resolves as wrong immediately on a distractor tap', () => {
      const target = num(7);
      const choices = [target, target, target, num(2), num(9)];
      const { canvas, onAnswer } = renderMultiTarget(choices, target);

      const distractor = fallerPosition(choices.length, 3); // num(2)
      fireEvent.pointerDown(canvas, { clientX: distractor.x, clientY: distractor.y });
      act(() => void vi.advanceTimersByTime(900));
      expect(onAnswer).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ pickedToken: 'n2', correctToken: 'n7' }),
      );
    });
  });

  describe('starts-with variant', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // Mirrors hearEngine's private shuffleColumns(n, () => 0) + column layout
    // formula so the test can compute exactly where each faller starts.
    function fallerPosition(n: number, index: number): { x: number; y: number } {
      const cols = Array.from({ length: n }, (_, i) => i);
      for (let i = cols.length - 1; i > 0; i -= 1) {
        const tmp = cols[i]!;
        cols[i] = cols[0]!; // rng() === 0 → j is always 0
        cols[0] = tmp;
      }
      return { x: HEAR_W * ((cols[index]! + 0.5) / n), y: -FALLER_R - index * 90 };
    }

    function renderStartsWith(choices: DeckItem[], target: DeckItem, startsWithTokens: string[], onAnswer = vi.fn()) {
      const { container } = render(
        <HearIt
          round={{ kind: 'hear', target, choices, variant: 'starts-with', startsWithTokens }}
          onAnswer={onAnswer}
          playFind={vi.fn()}
        />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: HEAR_W, height: HEAR_H, right: HEAR_W, bottom: HEAR_H, x: 0, y: 0, toJSON() {} }) as DOMRect;
      return { canvas, onAnswer };
    }

    it('needs both the target and the curated extra word tapped before it resolves as correct', () => {
      const target = letter('l02', 'Β', 'β'); // βιβλίο
      const extra = letter('l02#starts-with', 'Β', 'β'); // βάρκα
      const distractor = letter('l10', 'Κ', 'κ'); // κήπος — a different letter
      const choices = [target, extra, distractor];
      const { canvas, onAnswer } = renderStartsWith(choices, target, [extra.token]);

      const first = fallerPosition(choices.length, 0);
      fireEvent.pointerDown(canvas, { clientX: first.x, clientY: first.y });
      expect(onAnswer).not.toHaveBeenCalled(); // the other curated word is still out there

      const second = fallerPosition(choices.length, 1);
      fireEvent.pointerDown(canvas, { clientX: second.x, clientY: second.y });
      act(() => void vi.advanceTimersByTime(900)); // freeze beat before reporting
      expect(onAnswer).toHaveBeenCalledWith(true, expect.objectContaining({ correctToken: 'l02' }));
    });

    it('resolves as wrong immediately on an other-letter distractor tap', () => {
      const target = letter('l02', 'Β', 'β');
      const extra = letter('l02#starts-with', 'Β', 'β');
      const distractor = letter('l10', 'Κ', 'κ');
      const choices = [target, extra, distractor];
      const { canvas, onAnswer } = renderStartsWith(choices, target, [extra.token]);

      const wrong = fallerPosition(choices.length, 2);
      fireEvent.pointerDown(canvas, { clientX: wrong.x, clientY: wrong.y });
      act(() => void vi.advanceTimersByTime(900));
      expect(onAnswer).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ pickedToken: 'l10', correctToken: 'l02' }),
      );
    });
  });

  describe('spell variant', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // Mirrors hearEngine's private shuffleColumns(n, () => 0) + column layout
    // formula so the test can compute exactly where each faller starts.
    function fallerPosition(n: number, index: number): { x: number; y: number } {
      const cols = Array.from({ length: n }, (_, i) => i);
      for (let i = cols.length - 1; i > 0; i -= 1) {
        const tmp = cols[i]!;
        cols[i] = cols[0]!; // rng() === 0 → j is always 0
        cols[0] = tmp;
      }
      return { x: HEAR_W * ((cols[index]! + 0.5) / n), y: -FALLER_R - index * 90 };
    }

    function renderSpell(choices: DeckItem[], target: DeckItem, spellSequence: string[], playFind = vi.fn(), onAnswer = vi.fn()) {
      const { container } = render(
        <HearIt
          round={{ kind: 'hear', target, choices, variant: 'spell', spellSequence }}
          onAnswer={onAnswer}
          playFind={playFind}
        />,
      );
      const canvas = container.querySelector('canvas')!;
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: HEAR_W, height: HEAR_H, right: HEAR_W, bottom: HEAR_H, x: 0, y: 0, toJSON() {} }) as DOMRect;
      return { canvas, onAnswer, playFind };
    }

    it('needs every letter tapped in order before it resolves as correct', () => {
      const g = letter('l03', 'Γ', 'γ');
      const a = letter('l01', 'Α', 'α');
      const t2 = letter('l19', 'Τ', 'τ');
      const distractor = letter('l10', 'Κ', 'κ');
      const spellSequence = ['l03', 'l01', 'l19', 'l01']; // γάτα
      // Two 'Α' fallers, one per occurrence in the word.
      const choices = [g, a, t2, letter('l01', 'Α', 'α'), distractor];
      const { canvas, onAnswer, playFind } = renderSpell(choices, g, spellSequence);

      // Tap Γ (index 0) — correct, prompts the next letter (Α).
      let p = fallerPosition(choices.length, 0);
      fireEvent.pointerDown(canvas, { clientX: p.x, clientY: p.y });
      expect(onAnswer).not.toHaveBeenCalled();
      expect(playFind).toHaveBeenLastCalledWith('l01');

      // Tap the first Α (index 1) — correct, prompts Τ.
      p = fallerPosition(choices.length, 1);
      fireEvent.pointerDown(canvas, { clientX: p.x, clientY: p.y });
      expect(onAnswer).not.toHaveBeenCalled();
      expect(playFind).toHaveBeenLastCalledWith('l19');

      // Tap Τ (index 2) — correct, prompts Α again.
      p = fallerPosition(choices.length, 2);
      fireEvent.pointerDown(canvas, { clientX: p.x, clientY: p.y });
      expect(onAnswer).not.toHaveBeenCalled();
      expect(playFind).toHaveBeenLastCalledWith('l01');

      // Tap the second Α (index 3) — final letter, sequence complete.
      p = fallerPosition(choices.length, 3);
      fireEvent.pointerDown(canvas, { clientX: p.x, clientY: p.y });
      act(() => void vi.advanceTimersByTime(900)); // freeze beat before reporting
      expect(onAnswer).toHaveBeenCalledWith(true, expect.objectContaining({ correctToken: 'l03' }));
    });

    it('resolves as wrong immediately on an out-of-order tap', () => {
      const g = letter('l03', 'Γ', 'γ');
      const a = letter('l01', 'Α', 'α');
      const spellSequence = ['l03', 'l01']; // just the first two letters of γάτα
      const choices = [g, a];
      const { canvas, onAnswer } = renderSpell(choices, g, spellSequence);

      // Tap Α before Γ — wrong order.
      const p = fallerPosition(choices.length, 1);
      fireEvent.pointerDown(canvas, { clientX: p.x, clientY: p.y });
      act(() => void vi.advanceTimersByTime(900));
      expect(onAnswer).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ pickedToken: 'l01', correctToken: 'l03' }),
      );
    });
  });
});
