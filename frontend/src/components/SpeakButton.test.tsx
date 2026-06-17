import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeakButton } from './SpeakButton';
import { useI18nStore } from '../i18n/store';

// jsdom does not implement media playback; stub it so the component can run.
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  window.HTMLMediaElement.prototype.play = play;
  window.HTMLMediaElement.prototype.pause = pause;
  useI18nStore.getState().setTranslations({
    'card.listen': { el: 'Άκουσέ το', en: 'Listen' },
  });
});

describe('SpeakButton', () => {
  it('renders a labelled speaker button', () => {
    render(<SpeakButton src="/api/tts/chore/1.mp3" />);
    expect(screen.getByRole('button', { name: 'Άκουσέ το' })).toBeInTheDocument();
  });

  it('plays the audio on click', () => {
    render(<SpeakButton src="/api/tts/chore/1.mp3" />);
    fireEvent.click(screen.getByRole('button'));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not bubble the click to a flipping parent', () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <SpeakButton src="/api/tts/reward/3.mp3" />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
